import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

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

    const classInfo = childData._child_class.find((c: any) => c.is_current)?.m_classes;

    // データ整形
    const response = {
      success: true,
      data: {
        child_id: childData.id,
        basic_info: {
          family_name: childData.family_name,
          given_name: childData.given_name,
          family_name_kana: childData.family_name_kana,
          given_name_kana: childData.given_name_kana,
          nickname: childData.nickname,
          gender: childData.gender,
          birth_date: childData.birth_date,
          photo_url: childData.photo_url,
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
          parent_phone: childData.parent_phone,
          parent_email: childData.parent_email,
        },
        care_info: {
          allergies: childData.allergies,
          child_characteristics: childData.child_characteristics,
          parent_characteristics: childData.parent_characteristics,
        },
        permissions: {
          photo_permission_public: childData.photo_permission_public,
          photo_permission_share: childData.photo_permission_share,
        },
        siblings: (siblingsData || []).map((s: any) => ({
          child_id: s.m_children.id,
          name: `${s.m_children.family_name} ${s.m_children.given_name}`,
          relationship: s.relationship,
        })),
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
    const body = await request.json();
    const { basic_info, affiliation, contact, care_info, permissions } = body;

    // 子ども情報存在確認
    const { data: existingChild } = await supabase
      .from('m_children')
      .select('id')
      .eq('id', child_id)
      .eq('facility_id', userSession.current_facility_id)
      .is('deleted_at', null)
      .single();

    if (!existingChild) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    // 更新データ構築
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (basic_info) {
      if (basic_info.family_name) updateData.family_name = basic_info.family_name;
      if (basic_info.given_name) updateData.given_name = basic_info.given_name;
      if (basic_info.family_name_kana !== undefined) updateData.family_name_kana = basic_info.family_name_kana;
      if (basic_info.given_name_kana !== undefined) updateData.given_name_kana = basic_info.given_name_kana;
      if (basic_info.nickname !== undefined) updateData.nickname = basic_info.nickname;
      if (basic_info.gender !== undefined) updateData.gender = basic_info.gender;
      if (basic_info.birth_date !== undefined) updateData.birth_date = basic_info.birth_date;
    }

    if (affiliation) {
      if (affiliation.enrollment_status !== undefined) updateData.enrollment_status = affiliation.enrollment_status;
      if (affiliation.enrollment_type !== undefined) updateData.enrollment_type = affiliation.enrollment_type;
      if (affiliation.enrolled_at !== undefined) updateData.enrolled_at = affiliation.enrolled_at;
      if (affiliation.withdrawn_at !== undefined) updateData.withdrawn_at = affiliation.withdrawn_at;
    }

    if (contact) {
      if (contact.parent_phone !== undefined) updateData.parent_phone = contact.parent_phone;
      if (contact.parent_email !== undefined) updateData.parent_email = contact.parent_email;
    }

    if (care_info) {
      if (care_info.allergies !== undefined) updateData.allergies = care_info.allergies;
      if (care_info.child_characteristics !== undefined) updateData.child_characteristics = care_info.child_characteristics;
      if (care_info.parent_characteristics !== undefined) updateData.parent_characteristics = care_info.parent_characteristics;
    }

    if (permissions) {
      if (permissions.photo_permission_public !== undefined) updateData.photo_permission_public = permissions.photo_permission_public;
      if (permissions.photo_permission_share !== undefined) updateData.photo_permission_share = permissions.photo_permission_share;
    }

    // 子ども情報更新
    const { data: updatedChild, error: updateError } = await supabase
      .from('m_children')
      .update(updateData)
      .eq('id', child_id)
      .select()
      .single();

    if (updateError || !updatedChild) {
      console.error('Child update error:', updateError);
      return NextResponse.json({ error: 'Failed to update child' }, { status: 500 });
    }

    // クラス変更がある場合
    if (affiliation?.class_id) {
      // 既存のクラス所属を無効化
      await supabase
        .from('_child_class')
        .update({ is_current: false })
        .eq('child_id', child_id);

      // 新しいクラス所属を追加
      await supabase
        .from('_child_class')
        .insert({
          child_id,
          class_id: affiliation.class_id,
          is_current: true,
        });
    }

    // レスポンス構築
    const response = {
      success: true,
      data: {
        child_id: updatedChild.id,
        name: `${updatedChild.family_name} ${updatedChild.given_name}`,
        updated_at: updatedChild.updated_at,
      },
      message: '児童情報を更新しました',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Child PUT API Error:', error);
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
