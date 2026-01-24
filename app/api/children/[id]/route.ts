import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { handleChildSave } from '../save/route';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';

// 型定義
interface GuardianRelation {
  guardian_id: string;
  is_primary: boolean;
  is_emergency_contact: boolean;
  m_guardians: Guardian | null;
}

interface Guardian {
  id: string;
  facility_id: string;
  family_name: string;
  given_name: string;
  family_name_kana?: string;
  given_name_kana?: string;
  phone?: string;
  email?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface ClassRelation {
  class_id: string;
  is_current: boolean;
  m_classes?: {
    class_id: string;
    class_name: string;
  };
}

// GET /api/children/:id - 子ども詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
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
          relationship,
          is_primary,
          is_emergency_contact,
          m_guardians (
            id,
            family_name,
            given_name,
            phone,
            email
          )
        )
      `)
      .eq('id', child_id)
      .eq('facility_id', userSession.current_facility_id)
      .is('deleted_at', null)
      .single();

    if (childError || !childData) {
      console.error('Child fetch error:', childError);
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // 兄弟情報取得
    const { data: siblingsData } = await supabase
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
      .eq('child_id', child_id);

    const classInfo = childData._child_class.find((c: ClassRelation) => c.is_current)?.m_classes;

    // 保護者情報の整形
    const guardians: GuardianRelation[] = childData._child_guardian || [];
    const primaryGuardian = guardians.find((g: GuardianRelation) => g.is_primary);
    const emergencyContacts = guardians.filter((g: GuardianRelation) => g.is_emergency_contact && !g.is_primary);

    // 保護者情報の復号化
    const decryptGuardian = (guardian: GuardianRelation) => {
      if (!guardian) return null;
      return {
        ...guardian,
        family_name: decryptOrFallback(guardian.family_name),
        given_name: decryptOrFallback(guardian.given_name),
        phone: decryptOrFallback(guardian.phone),
        email: decryptOrFallback(guardian.email),
      };
    };

    const decryptedPrimaryGuardian = primaryGuardian ? {
      ...primaryGuardian,
      m_guardians: decryptGuardian(primaryGuardian.m_guardians),
    } : null;

    const decryptedEmergencyContacts = emergencyContacts.map((ec: GuardianRelation) => ({
      ...ec,
      m_guardians: ec.m_guardians ? decryptGuardian(ec) : null,
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
          photo_url: childData.photo_url,
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
                  decryptedPrimaryGuardian.m_guardians.family_name,
                  decryptedPrimaryGuardian.m_guardians.given_name,
                ],
                null
              )
            : decryptOrFallback(childData.parent_name) || null, // 後方互換性のためフォールバック
          parent_phone: decryptedPrimaryGuardian?.m_guardians.phone || decryptOrFallback(childData.parent_phone) || null,
          parent_email: decryptedPrimaryGuardian?.m_guardians.email || decryptOrFallback(childData.parent_email) || null,
          emergency_contacts: (() => {
            const formattedContacts = decryptedEmergencyContacts
              .filter((ec) => ec.m_guardians !== null)
              .map((ec) => ({
                name: formatName(
                  [ec.m_guardians!.family_name, ec.m_guardians!.given_name],
                  ''
                ) || '',
                relation: ec.relationship,
                phone: ec.m_guardians!.phone || '',
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
          const decryptedFamilyName = decryptOrFallback(s.m_children.family_name);
          const decryptedGivenName = decryptOrFallback(s.m_children.given_name);
          return {
            child_id: s.m_children.id,
            name: formatName([decryptedFamilyName, decryptedGivenName], ''),
            relationship: s.relationship,
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

// DELETE /api/children/:id - 子ども削除（論理削除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const { id: child_id } = await params;

    // 論理削除
    const { error: deleteError } = await supabase
      .from('m_children')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', child_id)
      .eq('facility_id', userSession.current_facility_id);

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
