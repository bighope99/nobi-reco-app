import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { encryptPII } from '@/utils/crypto/piiEncryption';
import { decryptOrFallback } from '@/utils/crypto/decryption-helper';
import { normalizePhone } from '@/lib/children/import-csv';
import {
  updateSearchIndex,
  searchByName,
} from '@/utils/pii/searchIndex';

const SIGNED_URL_EXPIRES_IN = 3600;
const GUARDIAN_PHOTO_BUCKET = 'guardian-photos';

async function getSignedPhotoUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoPath: string | null
): Promise<string | null> {
  if (!photoPath) return null;
  const { data, error } = await supabase.storage
    .from(GUARDIAN_PHOTO_BUCKET)
    .createSignedUrl(photoPath, SIGNED_URL_EXPIRES_IN);
  if (error || !data) return null;
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

    let guardianIds: string[] | null = null;

    // 子どもIDでフィルター
    if (childId) {
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

    // 名前検索
    if (query) {
      const nameIds = await searchByName(supabase, 'guardian', 'name', query);
      if (guardianIds !== null) {
        guardianIds = guardianIds.filter(id => nameIds.includes(id));
      } else {
        guardianIds = nameIds;
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
            given_name
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

    const result = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (guardians ?? []).map(async (g: any) => {
        const name = decryptOrFallback(g.family_name) ?? '';
        const kana = decryptOrFallback(g.family_name_kana) ?? '';
        const photoUrl = await getSignedPhotoUrl(supabase, g.photo_path);

        const linkedChildren = (g._child_guardian ?? [])
          .filter(link => link.m_children)
          .map(link => ({
            id: link.m_children!.id,
            name: [
              decryptOrFallback(link.m_children!.family_name),
              decryptOrFallback(link.m_children!.given_name),
            ]
              .filter(Boolean)
              .join(' '),
            relationship: link.relationship,
            is_primary: link.is_primary,
          }));

        // 続柄は_child_guardianのrelationshipから取得（is_primaryのものを優先）
        const primaryLink = g._child_guardian?.find(l => l.is_primary);
        const relationship = primaryLink?.relationship ?? g._child_guardian?.[0]?.relationship ?? null;

        return {
          id: g.id,
          name,
          kana,
          relationship,
          photo_url: photoUrl,
          linked_children: linkedChildren,
          notes: g.notes ?? '',
          updated_at: g.updated_at,
        };
      })
    );

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
    const { name, kana, phone, relationship, notes, child_id } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: '氏名は必須です' }, { status: 400 });
    }

    const normalizedPhone = phone ? normalizePhone(phone) : null;

    const { data: guardian, error } = await supabase
      .from('m_guardians')
      .insert({
        facility_id: current_facility_id,
        family_name: encryptPII(name.trim()),
        given_name: '',
        family_name_kana: kana?.trim() ? encryptPII(kana.trim()) : null,
        phone: normalizedPhone ? encryptPII(normalizedPhone) : null,
        notes: notes?.trim() || null,
      })
      .select('id')
      .single();

    if (error || !guardian) {
      console.error('Guardian creation error:', error?.message);
      return NextResponse.json({ error: '保護者の登録に失敗しました' }, { status: 500 });
    }

    // 検索インデックス更新
    await Promise.all([
      updateSearchIndex(supabase, 'guardian', guardian.id, 'name', name.trim()),
      normalizedPhone
        ? updateSearchIndex(supabase, 'guardian', guardian.id, 'phone', normalizedPhone)
        : Promise.resolve(),
    ]);

    // 子どもと紐づけ
    if (child_id && relationship) {
      const { error: linkError } = await supabase
        .from('_child_guardian')
        .upsert({
          child_id,
          guardian_id: guardian.id,
          relationship,
          is_primary: true,
          is_emergency_contact: true,
        }, { onConflict: 'child_id,guardian_id' });

      if (linkError) {
        console.error('Child-guardian link error:', linkError.message);
      }
    }

    return NextResponse.json({ success: true, data: { id: guardian.id } }, { status: 201 });
  } catch (error) {
    console.error('Guardians POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
