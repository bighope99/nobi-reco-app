import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { handleChildSave } from '../save/route';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';

// 型定義
interface GuardianRelation {
  guardian_id: string;
  relationship?: string | null;
  is_primary: boolean;
  is_emergency_contact: boolean;
  m_guardians: Guardian | null;
}

interface Guardian {
  id: string;
  facility_id: string;
  family_name: string;
  given_name: string;
  family_name_kana?: string | null;
  given_name_kana?: string | null;
  phone?: string;
  email?: string;
  photo_path?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ClassRelation {
  class_id: string;
  is_current: boolean;
  m_classes?: {
    id: string;
    name: string;
    age_group?: string | null;
  };
}

// GET /api/children/:id - 子ども詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const { id: child_id } = await params;

    // 子ども情報取得
    const { data: childData, error: childError } = await supabase
      .from('m_children')
      .select(`
        *,
        _child_class (
          class_id,
          is_current,
          m_classes (
            id,
            name,
            age_group
          )
        ),
        _child_guardian (
          guardian_id,
          relationship,
          is_primary,
          is_emergency_contact,
          m_guardians (
            id,
            family_name,
            family_name_kana,
            given_name,
            given_name_kana,
            phone,
            email,
            photo_path,
            deleted_at
          )
        )
      `)
      .eq('id', child_id)
      .eq('facility_id', current_facility_id)
      .is('deleted_at', null)
      .single();

    if (childError || !childData) {
      console.error('Child fetch error:', childError);
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const classInfo = childData._child_class.find((c: ClassRelation) => c.is_current)?.m_classes;

    // 保護者情報の復号化
    const decryptGuardian = (guardian: Guardian | null) => {
      if (!guardian) return null;
      return {
        ...guardian,
        family_name: decryptOrFallback(guardian.family_name),
        family_name_kana: guardian.family_name_kana ? decryptOrFallback(guardian.family_name_kana) : null,
        given_name: decryptOrFallback(guardian.given_name),
        given_name_kana: guardian.given_name_kana ? decryptOrFallback(guardian.given_name_kana) : null,
        phone: decryptOrFallback(guardian.phone),
        email: decryptOrFallback(guardian.email),
      };
    };

    // 兄弟情報取得と署名URL生成を並列実行
    const [{ data: siblingsData }, signedUrlResult] = await Promise.all([
      supabase
        .from('_child_sibling')
        .select(`
          sibling_id,
          relationship,
          m_children!_child_sibling_sibling_id_fkey (
            id,
            family_name,
            given_name
          )
        `)
        .eq('child_id', child_id),
      childData.photo_url
        ? supabase.storage.from('private-child-photos').createSignedUrl(childData.photo_url, 3600)
        : Promise.resolve({ data: null }),
    ]);

    const signedUrlData = signedUrlResult as { data: { signedUrl: string } | null; error?: { message: string } | null };
    if (signedUrlData?.error) {
      console.error('Signed URL generation error:', signedUrlData.error);
    }
    const photoSignedUrl: string | null = signedUrlData?.data?.signedUrl ?? null;

    // 保護者情報の整形（論理削除済み保護者を除外）
    const guardians: GuardianRelation[] = (childData._child_guardian || [])
      .filter((g: any) => g.m_guardians && g.m_guardians.deleted_at === null);
    const primaryGuardian = guardians.find((g: GuardianRelation) => g.is_primary);
    const emergencyContacts = guardians.filter((g: GuardianRelation) => g.is_emergency_contact && !g.is_primary);

    const decryptedPrimaryGuardian = primaryGuardian ? {
      ...primaryGuardian,
      m_guardians: primaryGuardian.m_guardians ? decryptGuardian(primaryGuardian.m_guardians) : null,
    } : null;

    // 筆頭保護者と緊急連絡先の写真署名URLを並列生成
    const ecPhotoPaths = emergencyContacts
      .map((ec: GuardianRelation) => ec.m_guardians?.photo_path)
      .filter((p): p is string => !!p);

    const [parentPhotoResult, ecSignedResult] = await Promise.all([
      decryptedPrimaryGuardian?.m_guardians?.photo_path
        ? supabase.storage
            .from('guardian-photos')
            .createSignedUrl(decryptedPrimaryGuardian.m_guardians.photo_path, 3600)
        : Promise.resolve({ data: null, error: null }),
      ecPhotoPaths.length > 0
        ? supabase.storage.from('guardian-photos').createSignedUrls(ecPhotoPaths, 3600)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (parentPhotoResult.error) {
      console.error('Failed to create signed URL for primary guardian photo:', parentPhotoResult.error.message);
    }
    const parentPhotoSignedUrl = parentPhotoResult.data && 'signedUrl' in parentPhotoResult.data
      ? (parentPhotoResult.data as { signedUrl: string }).signedUrl
      : null;

    if (ecSignedResult.error) {
      console.error('Failed to create signed URLs for guardian photos:', ecSignedResult.error.message);
    }
    const ecUrlMap = new Map<string, string>();
    ((ecSignedResult.data as Array<{ path: string; signedUrl: string }> | null) ?? []).forEach((u) => {
      if (u.path && u.signedUrl) ecUrlMap.set(u.path, u.signedUrl);
    });

    // 同期 map に変更
    const decryptedEmergencyContacts = emergencyContacts.map((ec: GuardianRelation) => ({
      ...ec,
      m_guardians: ec.m_guardians ? decryptGuardian(ec.m_guardians) : null,
      guardian_photo_url: ec.m_guardians?.photo_path
        ? ecUrlMap.get(ec.m_guardians.photo_path) ?? null
        : null,
    }));

    // データ整形
    const response = {
      success: true,
      data: {
        child_id: childData.id,
        basic_info: {
          family_name: decryptOrFallback(childData.family_name),
          given_name: decryptOrFallback(childData.given_name),
          family_name_kana: decryptOrFallback(childData.family_name_kana),
          given_name_kana: decryptOrFallback(childData.given_name_kana),
          nickname: childData.nickname,
          gender: childData.gender,
          birth_date: childData.birth_date,
          photo_url: photoSignedUrl,
          school_id: childData.school_id,
          grade_add: childData.grade_add || 0,
        },
        affiliation: {
          enrollment_status: childData.enrollment_status,
          enrollment_type: childData.enrollment_type,
          enrolled_at: childData.enrolled_at,
          withdrawn_at: childData.withdrawn_at,
          class_id: classInfo?.id || null,
          class_name: classInfo?.name || '',
          age_group: classInfo?.age_group || '',
        },
        contact: {
          parent_name: decryptedPrimaryGuardian
            ? formatName(
                [
                  decryptedPrimaryGuardian.m_guardians?.family_name,
                  decryptedPrimaryGuardian.m_guardians?.given_name,
                ],
                null
              )
            : decryptOrFallback(childData.parent_name) || null, // 後方互換性のためフォールバック
          parent_kana: decryptedPrimaryGuardian?.m_guardians
            ? formatName([
                decryptedPrimaryGuardian.m_guardians.family_name_kana ?? null,
                decryptedPrimaryGuardian.m_guardians.given_name_kana ?? null,
              ], null)
            : null,
          parent_phone: decryptedPrimaryGuardian?.m_guardians?.phone || decryptOrFallback(childData.parent_phone) || null,
          parent_email: decryptedPrimaryGuardian?.m_guardians?.email || decryptOrFallback(childData.parent_email) || null,
          parent_relation: decryptedPrimaryGuardian?.relationship || null,
          parent_photo_url: parentPhotoSignedUrl,
          emergency_contacts: (() => {
            const formattedContacts = decryptedEmergencyContacts
              .filter((ec) => ec.m_guardians !== null)
              .map((ec) => ({
                guardian_id: ec.m_guardians!.id,
                name: formatName(
                  [ec.m_guardians!.family_name, ec.m_guardians!.given_name],
                  ''
                ) || '',
                kana: formatName([
                  ec.m_guardians!.family_name_kana ?? null,
                  ec.m_guardians!.given_name_kana ?? null,
                ], null) || null,
                relation: ec.relationship,
                phone: ec.m_guardians!.phone || '',
                photo_url: ec.guardian_photo_url ?? null,
              }));
            return formattedContacts;
          })(),
        },
        care_info: {
          allergies: decryptOrFallback(childData.allergies),
          child_characteristics: decryptOrFallback(childData.child_characteristics),
          parent_characteristics: decryptOrFallback(childData.parent_characteristics),
        },
        permissions: {
          photo_permission_public: childData.photo_permission_public,
          photo_permission_share: childData.photo_permission_share,
        },
        siblings: (siblingsData || []).map((s) => {
          const sibling = Array.isArray(s.m_children) ? s.m_children[0] : s.m_children;
          const decryptedFamilyName = decryptOrFallback(sibling?.family_name);
          const decryptedGivenName = decryptOrFallback(sibling?.given_name);
          return {
            child_id: sibling?.id,
            name: formatName([decryptedFamilyName, decryptedGivenName], ''),
            relationship: s.relationship,
          };
        }),
        guardians: guardians
          .filter((g: GuardianRelation) => g.m_guardians !== null)
          .map((g: GuardianRelation) => {
            const decrypted = decryptGuardian(g.m_guardians);
            return {
              guardian_id: g.guardian_id,
              name: decrypted
                ? formatName([decrypted.family_name, decrypted.given_name], '')
                : '',
              phone: decrypted?.phone || '',
              email: decrypted?.email || '',
              relationship: g.relationship || '',
              is_primary: g.is_primary,
              is_emergency_contact: g.is_emergency_contact,
            };
          }),
        created_at: childData.created_at,
        updated_at: childData.updated_at,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Child GET API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/children/:id - 子ども情報更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: child_id } = await params;
  return handleChildSave(request, child_id);
}

// PATCH /api/children/:id - 子どものステータス更新（enrollment_statusのみ）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: child_id } = await params;
    const body = await request.json();
    const { enrollment_status } = body;

    if (!enrollment_status || !['enrolled', 'withdrawn'].includes(enrollment_status)) {
      return NextResponse.json({ error: 'Invalid enrollment_status' }, { status: 400 });
    }

    const { data: updatedRows, error: updateError } = await supabase
      .from('m_children')
      .update({
        enrollment_status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', child_id)
      .eq('facility_id', current_facility_id)
      .is('deleted_at', null)
      .select('id');

    if (updateError) {
      console.error('Child status update error:', updateError.message);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'ステータスを更新しました' });
  } catch (error) {
    console.error('Child PATCH API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/children/:id - 子ども削除（論理削除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    if (metadata.role !== 'company_admin' && metadata.role !== 'site_admin') {
      return NextResponse.json({ error: '子どもの削除はcompany_admin以上の権限が必要です' }, { status: 403 });
    }

    const { id: child_id } = await params;

    // 論理削除
    const { error: deleteError } = await supabase
      .from('m_children')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', child_id)
      .eq('facility_id', current_facility_id);

    if (deleteError) {
      console.error('Child delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete child' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '児童を削除しました',
    });
  } catch (error) {
    console.error('Child DELETE API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
