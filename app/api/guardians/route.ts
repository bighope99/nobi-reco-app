import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { encryptPII } from '@/utils/crypto/piiEncryption';
import { decryptOrFallback } from '@/utils/crypto/decryption-helper';
import { normalizePhone } from '@/lib/children/import-csv';
import {
  updateSearchIndex,
  searchByName,
  searchByPhone,
} from '@/utils/pii/searchIndex';
import { toKatakana, toHiragana, normalizeSearch } from '@/lib/utils/kana';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';

const SIGNED_URL_EXPIRES_IN = 3600;
const GUARDIAN_PHOTO_BUCKET = 'guardian-photos';

function validatePhotoPath(photoPath: string | undefined | null, facilityId: string): boolean {
  if (!photoPath) return true;
  return photoPath.startsWith(`${facilityId}/`);
}

async function getSignedPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoPath: string | null
): Promise<string | null> {
  if (!photoPath) return null;
  const { data, error } = await supabase.storage
    .from(GUARDIAN_PHOTO_BUCKET)
    .createSignedUrl(photoPath, SIGNED_URL_EXPIRES_IN);
  if (error || !data) {
    if (error) console.error('Failed to create signed URL for photo:', photoPath, error.message);
    return null;
  }
  return data.signedUrl;
}

// GET /api/guardians — 保護者一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    const childId = searchParams.get('child_id')?.trim() ?? '';
    const childName = searchParams.get('child_name')?.trim() ?? '';

    let guardianIds: string[] | null = null;

    // 子どもIDでフィルター
    if (childId) {
      // child_id が自施設に属するか確認
      const { data: childCheck } = await supabase
        .from('m_children')
        .select('id')
        .eq('id', childId)
        .eq('facility_id', current_facility_id)
        .is('deleted_at', null)
        .single();
      if (!childCheck) {
        return NextResponse.json({ error: '指定された子どもが見つかりません' }, { status: 400 });
      }

      const { data: links, error: linkError } = await supabase
        .from('_child_guardian')
        .select('guardian_id')
        .eq('child_id', childId);
      if (linkError) {
        console.error('Error fetching child-guardian links:', linkError.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
      }
      const ids = (links ?? []).map((l: { guardian_id: string }) => l.guardian_id);
      if (ids.length === 0) {
        return NextResponse.json({ data: [] });
      }
      guardianIds = ids;
    }

    // 子ども名検索
    if (childName) {
      const nameChildIds = await searchByName(supabase, 'child', 'name', childName);

      // カナは平文なので直接DB検索（カタカナ・ひらがな両方でOR検索）
      const katakanaChildName = normalizeSearch(childName);
      const hiraganaChildName = toHiragana(katakanaChildName);
      const escapeForIlike = (s: string) =>
        s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const escapedKatakana = escapeForIlike(katakanaChildName);
      const escapedHiragana = escapeForIlike(hiraganaChildName);
      const { data: kanaChildMatches, error: kanaError } = await supabase
        .from('m_children')
        .select('id')
        .eq('facility_id', current_facility_id)
        .is('deleted_at', null)
        .or(`family_name_kana.ilike.%${escapedKatakana}%,given_name_kana.ilike.%${escapedKatakana}%,family_name_kana.ilike.%${escapedHiragana}%,given_name_kana.ilike.%${escapedHiragana}%`);
      if (kanaError) {
        console.error('Kana child search error:', kanaError.message);
      }

      const allChildIds = [...new Set([...nameChildIds, ...(kanaChildMatches ?? []).map((c: { id: string }) => c.id)])];

      if (allChildIds.length > 0) {
        const { data: links, error: linksError } = await supabase
          .from('_child_guardian')
          .select('guardian_id')
          .in('child_id', allChildIds);
        if (linksError) {
          console.error('Child-guardian link search error:', linksError.message);
        }
        const ids = [...new Set((links ?? []).map((l: { guardian_id: string }) => l.guardian_id))];
        guardianIds = guardianIds !== null ? guardianIds.filter(id => ids.includes(id)) : ids;
      } else {
        return NextResponse.json({ data: [] });
      }
      if (guardianIds.length === 0) {
        return NextResponse.json({ data: [] });
      }
    }

    // 保護者名検索（漢字名 + カナ両方）
    if (query) {
      const [nameIds, kanaKatakanaIds, kanaHiraganaIds] = await Promise.all([
        searchByName(supabase, 'guardian', 'name', query),
        searchByName(supabase, 'guardian', 'name_kana', toKatakana(query)),
        searchByName(supabase, 'guardian', 'name_kana', toHiragana(query)),
      ]);
      const mergedIds = [...new Set([...nameIds, ...kanaKatakanaIds, ...kanaHiraganaIds])];

      if (guardianIds !== null) {
        guardianIds = guardianIds.filter(id => mergedIds.includes(id));
      } else {
        guardianIds = mergedIds;
      }
      if (guardianIds.length === 0) {
        return NextResponse.json({ data: [] });
      }
    }

    let dbQuery = supabase
      .from('m_guardians')
      .select(`
        id,
        family_name,
        family_name_kana,
        phone,
        photo_path,
        notes,
        updated_at,
        _child_guardian (
          relationship,
          is_primary,
          child_id,
          m_children (
            id,
            family_name,
            given_name,
            enrollment_status,
            birth_date,
            grade_add
          )
        )
      `)
      .eq('facility_id', current_facility_id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (guardianIds !== null) {
      dbQuery = dbQuery.in('id', guardianIds);
    }

    const { data: guardians, error } = await dbQuery;

    if (error) {
      console.error('Error fetching guardians:', error.message);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }

    const resultRaw = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (guardians ?? []).map(async (g: any) => {
        const name = decryptOrFallback(g.family_name) ?? '';
        const kana = decryptOrFallback(g.family_name_kana) ?? '';
        const phone = decryptOrFallback(g.phone) ?? '';
        const photoUrl = await getSignedPhotoUrl(supabase, g.photo_path);

        const linkedChildren = (g._child_guardian ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((link: any) => link.m_children)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((link: any) => {
            const grade = calculateGrade(link.m_children.birth_date, link.m_children.grade_add);
            const rawLabel = formatGradeLabel(grade);
            const gradeLabel = rawLabel === '未就学' ? '未就学児' : rawLabel;
            return {
              id: link.m_children.id,
              name: [
                decryptOrFallback(link.m_children.family_name),
                decryptOrFallback(link.m_children.given_name),
              ]
                .filter(Boolean)
                .join(' '),
              relationship: link.relationship,
              is_primary: link.is_primary,
              grade_label: gradeLabel,
              enrollment_status: link.m_children.enrollment_status,
            };
          });

        // 紐づき無し、または全員退所済みの保護者は非表示
        if (linkedChildren.length === 0) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasActiveChild = linkedChildren.some((c: any) => c.enrollment_status === 'enrolled');
        if (!hasActiveChild) return null;

        // 続柄は_child_guardianのrelationshipから取得（is_primaryのものを優先）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const primaryLink = g._child_guardian?.find((l: any) => l.is_primary);
        const relationship = primaryLink?.relationship ?? g._child_guardian?.[0]?.relationship ?? null;

        return {
          id: g.id,
          name,
          kana,
          phone,
          relationship,
          photo_url: photoUrl,
          linked_children: linkedChildren,
          notes: g.notes ?? '',
          updated_at: g.updated_at,
        };
      })
    );

    const result = resultRaw.filter(Boolean);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Guardians GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/guardians — 保護者新規作成
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, kana, phone, relationship, notes, child_id, photo_path } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: '氏名は必須です' }, { status: 400 });
    }

    if (!validatePhotoPath(photo_path, current_facility_id)) {
      return NextResponse.json({ error: '無効な写真パスです' }, { status: 400 });
    }

    // child_id が自施設に属するか確認（INSERT前に検証してレコード孤立を防ぐ）
    if (child_id && relationship) {
      const { data: childCheck } = await supabase
        .from('m_children')
        .select('id')
        .eq('id', child_id)
        .eq('facility_id', current_facility_id)
        .is('deleted_at', null)
        .single();
      if (!childCheck) {
        return NextResponse.json({ error: '指定された子どもが見つかりません' }, { status: 400 });
      }
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null;

    // 電話番号重複チェック: 同じ電話番号の保護者が既に存在すれば既存レコードを使う
    let guardianId: string | null = null;

    if (normalizedPhone) {
      try {
        const entityIds = await searchByPhone(supabase, 'guardian', normalizedPhone);
        if (entityIds.length > 0) {
          const { data: existingGuardians } = await supabase
            .from('m_guardians')
            .select('id')
            .eq('facility_id', current_facility_id)
            .in('id', entityIds)
            .is('deleted_at', null)
            .limit(1);
          if (existingGuardians && existingGuardians.length > 0) {
            guardianId = existingGuardians[0].id;
            // 既存保護者の情報を更新
            const { error: updateError } = await supabase
              .from('m_guardians')
              .update({
                family_name: encryptPII(name.trim()),
                given_name: '',
                family_name_kana: kana?.trim() ? encryptPII(kana.trim()) : null,
                notes: notes?.trim() || null,
                ...(photo_path ? { photo_path } : {}),
                updated_at: new Date().toISOString(),
              })
              .eq('id', guardianId);

            if (updateError) {
              console.error('Guardian update error:', updateError.message, 'guardianId:', guardianId);
            }

            // 検索インデックス更新
            const updateIdxPromises = [];
            if (name.trim()) {
              updateIdxPromises.push(updateSearchIndex(supabase, 'guardian', guardianId!, 'name', name.trim()));
            }
            if (kana?.trim()) {
              updateIdxPromises.push(updateSearchIndex(supabase, 'guardian', guardianId!, 'name_kana', kana.trim()));
            }
            if (normalizedPhone) {
              updateIdxPromises.push(updateSearchIndex(supabase, 'guardian', guardianId!, 'phone', normalizedPhone));
            }
            if (updateIdxPromises.length > 0) {
              try {
                await Promise.all(updateIdxPromises);
              } catch (indexError) {
                console.error('Search index update failed (guardian update):', guardianId, indexError);
              }
            }
          }
        }
      } catch (searchError) {
        console.error('Guardian phone search failed, skipping dedup:', searchError);
      }
    }

    if (!guardianId) {
      const { data: guardian, error } = await supabase
        .from('m_guardians')
        .insert({
          facility_id: current_facility_id,
          family_name: encryptPII(name.trim()),
          given_name: '',
          family_name_kana: kana?.trim() ? encryptPII(kana.trim()) : null,
          phone: normalizedPhone ? encryptPII(normalizedPhone) : null,
          notes: notes?.trim() || null,
          photo_path: photo_path || null,
        })
        .select('id')
        .single();

      if (error || !guardian) {
        console.error('Guardian creation error:', error?.message);
        return NextResponse.json({ error: '保護者の登録に失敗しました' }, { status: 500 });
      }

      guardianId = guardian.id;

      // 検索インデックス更新
      const newGuardianId: string = guardian.id;
      try {
        await Promise.all([
          updateSearchIndex(supabase, 'guardian', newGuardianId, 'name', name.trim()),
          kana?.trim()
            ? updateSearchIndex(supabase, 'guardian', newGuardianId, 'name_kana', kana.trim())
            : Promise.resolve(),
          normalizedPhone
            ? updateSearchIndex(supabase, 'guardian', newGuardianId, 'phone', normalizedPhone)
            : Promise.resolve(),
        ]);
      } catch (indexError) {
        console.error('Search index update failed (guardian created):', newGuardianId, indexError);
      }
    }

    if (!guardianId) {
      return NextResponse.json({ error: '保護者の登録に失敗しました' }, { status: 500 });
    }

    // 子どもと紐づけ
    if (child_id && relationship) {
      const { error: linkError } = await supabase
        .from('_child_guardian')
        .upsert({
          child_id,
          guardian_id: guardianId,
          relationship,
          is_primary: true,
          is_emergency_contact: true,
        }, { onConflict: 'child_id,guardian_id' });

      if (linkError) {
        console.error('Child-guardian link error:', linkError.message);
        return NextResponse.json(
          {
            guardianId,
            warning: '保護者は登録されましたが、子どもとの紐づけに失敗しました',
            linkError: linkError.message,
          },
          { status: 207 }
        );
      }

      // 兄弟がいれば自動的に紐づけ
      const { data: siblingLinks } = await supabase
        .from('_child_sibling')
        .select('sibling_id')
        .eq('child_id', child_id);

      if (siblingLinks && siblingLinks.length > 0) {
        const siblingIds = siblingLinks.map((s: { sibling_id: string }) => s.sibling_id);

        const { data: validSiblings, error: validSiblingsError } = await supabase
          .from('m_children')
          .select('id')
          .in('id', siblingIds)
          .eq('facility_id', current_facility_id)
          .is('deleted_at', null);

        if (validSiblingsError) {
          console.error('Sibling fetch error:', validSiblingsError.message);
        }

        if (validSiblings && validSiblings.length > 0) {
          const siblingUpserts = validSiblings.map((s: { id: string }) => ({
            child_id: s.id,
            guardian_id: guardianId,
            relationship,
            is_primary: false,
            is_emergency_contact: true,
          }));

          const { error: siblingLinkError } = await supabase
            .from('_child_guardian')
            .upsert(siblingUpserts, { onConflict: 'child_id,guardian_id' });

          if (siblingLinkError) {
            console.error('Sibling-guardian link error:', siblingLinkError.message);
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: { id: guardianId } }, { status: 201 });
  } catch (error) {
    console.error('Guardians POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
