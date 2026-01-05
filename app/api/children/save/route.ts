import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export interface ChildPayload {
  child_id?: string;
  basic_info?: {
    family_name?: string;
    given_name?: string;
    family_name_kana?: string;
    given_name_kana?: string;
    nickname?: string | null;
    gender?: string;
    birth_date?: string;
    school_id?: string | null;
    grade_add?: number;
  };
  affiliation?: {
    enrollment_status?: string;
    enrollment_type?: string;
    enrolled_at?: string;
    withdrawn_at?: string | null;
    class_id?: string | null;
  };
  contact?: {
    parent_name?: string;           // 保護者名（追加）
    parent_phone?: string;
    parent_email?: string;
    emergency_contacts?: Array<{    // 緊急連絡先リスト（追加）
      name: string;
      relation: string;
      phone: string;
    }>;
  };
  care_info?: {
    allergies?: string | null;
    child_characteristics?: string | null;
    parent_characteristics?: string | null;
  };
  permissions?: {
    photo_permission_public?: boolean;
    photo_permission_share?: boolean;
  };
}

export async function saveChild(
  payload: ChildPayload,
  facilityId: string,
  supabase: any,
  targetChildId?: string,
  options?: { skipParentLegacy?: boolean },
) {
  const { basic_info, affiliation, contact, care_info, permissions } = payload;

  if (!basic_info?.family_name || !basic_info?.given_name || !basic_info?.birth_date || !affiliation?.enrolled_at) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const child_id = targetChildId || payload.child_id || null;
  const isUpdate = !!child_id;

  if (isUpdate) {
    const { data: existingChild } = await supabase
      .from('m_children')
      .select('id')
      .eq('id', child_id)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .single();

    if (!existingChild) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }
  }

  const shouldSaveParentLegacy = !options?.skipParentLegacy;
  const childValues: any = {
    facility_id: facilityId,
    school_id: basic_info.school_id || null,
    family_name: basic_info.family_name,
    given_name: basic_info.given_name,
    family_name_kana: basic_info.family_name_kana || '',
    given_name_kana: basic_info.given_name_kana || '',
    nickname: basic_info.nickname || null,
    gender: basic_info.gender || 'other',
    birth_date: basic_info.birth_date,
    grade_add: basic_info.grade_add !== undefined ? basic_info.grade_add : 0,
    enrollment_status: affiliation.enrollment_status || 'enrolled',
    enrollment_type: affiliation.enrollment_type || 'regular',
    enrolled_at: affiliation.enrolled_at ? new Date(affiliation.enrolled_at).toISOString() : new Date().toISOString(),
    withdrawn_at: affiliation.withdrawn_at ? new Date(affiliation.withdrawn_at).toISOString() : null,
    parent_name: shouldSaveParentLegacy ? (contact?.parent_name || null) : null,
    parent_phone: shouldSaveParentLegacy ? (contact?.parent_phone || '') : '',
    parent_email: shouldSaveParentLegacy ? (contact?.parent_email || '') : '',
    allergies: care_info?.allergies || null,
    child_characteristics: care_info?.child_characteristics || null,
    parent_characteristics: care_info?.parent_characteristics || null,
    photo_permission_public: permissions?.photo_permission_public !== false,
    photo_permission_share: permissions?.photo_permission_share !== false,
  };

  let result;
  if (isUpdate) {
    childValues.updated_at = new Date().toISOString();
    const { data: updatedChild, error: updateError } = await supabase
      .from('m_children')
      .update(childValues)
      .eq('id', child_id)
      .select()
      .single();

    if (updateError || !updatedChild) {
      console.error('Child update error:', updateError);
      return NextResponse.json({ error: 'Failed to update child' }, { status: 500 });
    }
    result = updatedChild;
  } else {
    const { data: childData, error: childError } = await supabase
      .from('m_children')
      .insert(childValues)
      .select()
      .single();

    if (childError || !childData) {
      console.error('Child creation error:', childError);
      return NextResponse.json({ error: 'Failed to create child' }, { status: 500 });
    }
    result = childData;
  }

  // クラス紐付け処理
  if (affiliation?.class_id) {
    const enrollmentDate = affiliation.enrolled_at || new Date().toISOString().split('T')[0];

    if (isUpdate) {
      await supabase
        .from('_child_class')
        .update({ is_current: false })
        .eq('child_id', result.id);
    }

    const { error: classError } = await supabase
      .from('_child_class')
      .insert({
        child_id: result.id,
        class_id: affiliation.class_id,
        school_year: new Date().getFullYear(),
        started_at: enrollmentDate,
        is_current: true,
      });

    if (classError) {
      console.error('Class assignment error:', classError);
    }
  }

  // 保護者情報の保存処理
  if (contact?.parent_name || contact?.emergency_contacts) {
    // 更新時は既存の保護者紐付けを削除
    if (isUpdate) {
      await supabase
        .from('_child_guardian')
        .delete()
        .eq('child_id', result.id);
    }

    // 主たる保護者の保存
    if (contact.parent_name) {
      // 名前から姓と名に分割（スペース区切り）
      const nameParts = contact.parent_name.trim().split(/\s+/);
      const familyName = nameParts[0] || contact.parent_name;
      const givenName = nameParts.slice(1).join(' ') || '';

      const { data: guardianData, error: guardianError } = await supabase
        .from('m_guardians')
        .insert({
          facility_id: facilityId,
          family_name: familyName,
          given_name: givenName,
          phone: contact.parent_phone || null,
          email: contact.parent_email || null,
        })
        .select('id')
        .single();

      if (guardianError || !guardianData) {
        console.error('Guardian creation error:', guardianError);
      } else {
        // 児童と保護者を紐付け
        const { error: linkError } = await supabase
          .from('_child_guardian')
          .insert({
            child_id: result.id,
            guardian_id: guardianData.id,
            relationship: '保護者',
            is_primary: true,
            is_emergency_contact: true,
          });

        if (linkError) {
          console.error('Child-guardian link error:', linkError);
        }
      }
    }

    // 緊急連絡先の保存
    if (contact.emergency_contacts && contact.emergency_contacts.length > 0) {
      for (const emergencyContact of contact.emergency_contacts) {
        if (!emergencyContact.name || !emergencyContact.phone) continue;

        // 名前から姓と名に分割
        const nameParts = emergencyContact.name.trim().split(/\s+/);
        const familyName = nameParts[0] || emergencyContact.name;
        const givenName = nameParts.slice(1).join(' ') || '';

        const { data: emergencyGuardianData, error: emergencyGuardianError } = await supabase
          .from('m_guardians')
          .insert({
            facility_id: facilityId,
            family_name: familyName,
            given_name: givenName,
            phone: emergencyContact.phone,
          })
          .select('id')
          .single();

        if (emergencyGuardianError || !emergencyGuardianData) {
          console.error('Emergency contact creation error:', emergencyGuardianError);
        } else {
          // 児童と緊急連絡先を紐付け
          const { error: emergencyLinkError } = await supabase
            .from('_child_guardian')
            .insert({
              child_id: result.id,
              guardian_id: emergencyGuardianData.id,
              relationship: emergencyContact.relation || 'その他',
              is_primary: false,
              is_emergency_contact: true,
            });

          if (emergencyLinkError) {
            console.error('Emergency contact link error:', emergencyLinkError);
          }
        }
      }
    }
  }

  const response = {
    success: true,
    data: {
      child_id: result.id,
      name: `${result.family_name} ${result.given_name}`,
      kana: `${result.family_name_kana} ${result.given_name_kana}`,
      enrollment_date: result.enrollment_date,
      created_at: result.created_at,
      updated_at: result.updated_at,
    },
    message: isUpdate ? '児童情報を更新しました' : '児童を登録しました',
  };

  return NextResponse.json(response, { status: isUpdate ? 200 : 201 });
}

export async function handleChildSave(request: NextRequest, childId?: string) {
  try {
    const supabase = await createClient();

    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const body: ChildPayload = await request.json();

    return saveChild(body, userSession.current_facility_id, supabase, childId);
  } catch (error) {
    console.error('Children SAVE API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleChildSave(request);
}
