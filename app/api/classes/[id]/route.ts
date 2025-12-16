import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';

/**
 * GET /api/classes/:id
 * クラス詳細取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: classId } = await params;

    // クラス基本情報取得
    const { data: classData, error: classError } = await supabase
      .from('m_classes')
      .select(
        `
        id,
        name,
        age_group,
        capacity,
        room_number,
        color_code,
        is_active,
        display_order,
        facility_id,
        m_facilities!inner (
          id,
          name
        ),
        created_at,
        updated_at
      `
      )
      .eq('id', classId)
      .is('deleted_at', null)
      .single();

    if (classError || !classData) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    // 権限チェック
    const { data: userData } = await supabase
      .from('m_users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (userData.role === 'facility_admin' || userData.role === 'staff') {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const facilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
      if (!facilityIds.includes(classData.facility_id)) {
        return NextResponse.json(
          { success: false, error: 'Class not found' },
          { status: 404 }
        );
      }
    }

    // 担当職員取得
    const { data: staffAssignments } = await supabase
      .from('_user_class')
      .select(
        `
        class_role,
        m_users!inner (
          id,
          name,
          role
        )
      `
      )
      .eq('class_id', classId)
      .eq('is_current', true);

    const staff =
      staffAssignments?.map((sa: any) => ({
        id: sa.m_users.id,
        name: sa.m_users.name,
        role: sa.m_users.role,
        class_role: sa.class_role,
      })) || [];

    // 所属児童取得（_child_classで現在のクラス紐付けを判定）
    const { data: children, error: childrenError } = await supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        birth_date,
        grade_add,
        photo_url,
        enrollment_status,
        _child_class!inner (
          class_id,
          is_current
        )
      `)
      .eq('_child_class.class_id', classId)
      .eq('_child_class.is_current', true)
      .eq('enrollment_status', 'enrolled')
      .is('deleted_at', null)
      .order('family_name_kana', { ascending: true })
      .order('given_name_kana', { ascending: true });

    if (childrenError) {
      throw childrenError;
    }

    // 在籍児童数カウント
    const currentCount = children?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        class_id: classData.id,
        name: classData.name,
        age_group: classData.age_group,
        capacity: classData.capacity,
        current_count: currentCount,
        room_number: classData.room_number,
        color_code: classData.color_code,
        is_active: classData.is_active,
        display_order: classData.display_order,
        facility_id: classData.facility_id,
        facility_name: (classData.m_facilities as any).name,
        staff: staff,
        children:
          children?.map((child) => {
            const grade = calculateGrade(child.birth_date, child.grade_add);
              const gradeLabel = formatGradeLabel(grade);

            return {
              id: child.id,
              name: `${child.family_name} ${child.given_name}`,
              name_kana: `${child.family_name_kana} ${child.given_name_kana}`,
              birth_date: child.birth_date,
              grade,
              grade_label: gradeLabel,
              age: child.birth_date
                ? Math.floor(
                  (new Date().getTime() - new Date(child.birth_date).getTime()) /
                  (365.25 * 24 * 60 * 60 * 1000)
                )
                : null,
              photo_url: child.photo_url,
              enrollment_status: child.enrollment_status,
            };
          }) || [],
        created_at: classData.created_at,
        updated_at: classData.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching class details:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/classes/:id
 * クラス情報更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ユーザー情報取得
    const { data: userData } = await supabase
      .from('m_users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 権限チェック（staffは更新不可）
    if (userData.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id: classId } = await params;

    // クラスの存在確認
    const { data: classData, error: classError } = await supabase
      .from('m_classes')
      .select('id, facility_id')
      .eq('id', classId)
      .is('deleted_at', null)
      .single();

    if (classError || !classData) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (userData.role === 'facility_admin') {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const facilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
      if (!facilityIds.includes(classData.facility_id)) {
        return NextResponse.json(
          { success: false, error: 'Class not found' },
          { status: 404 }
        );
      }
    }

    const body = await request.json();

    // 更新データ準備
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.age_group !== undefined) updateData.age_group = body.age_group;
    if (body.capacity !== undefined) updateData.capacity = body.capacity;
    if (body.room_number !== undefined) updateData.room_number = body.room_number;
    if (body.color_code !== undefined) updateData.color_code = body.color_code;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    // クラス情報更新
    const { data: updatedClass, error: updateError } = await supabase
      .from('m_classes')
      .update(updateData)
      .eq('id', classId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        class_id: updatedClass.id,
        name: updatedClass.name,
        updated_at: updatedClass.updated_at,
      },
      message: 'クラス情報を更新しました',
    });
  } catch (error) {
    console.error('Error updating class:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/classes/:id
 * クラス削除（ソフトデリート）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ユーザー情報取得
    const { data: userData } = await supabase
      .from('m_users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 権限チェック（staffは削除不可）
    if (userData.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id: classId } = await params;

    // クラスの存在確認
    const { data: classData, error: classError } = await supabase
      .from('m_classes')
      .select('id, name, facility_id')
      .eq('id', classId)
      .is('deleted_at', null)
      .single();

    if (classError || !classData) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (userData.role === 'facility_admin') {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const facilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
      if (!facilityIds.includes(classData.facility_id)) {
        return NextResponse.json(
          { success: false, error: 'Class not found' },
          { status: 404 }
        );
      }
    }

    const deletedAt = new Date().toISOString();

    // クラス削除（ソフトデリート）
    const { error: deleteError } = await supabase
      .from('m_classes')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('id', classId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      data: {
        class_id: classData.id,
        name: classData.name,
        deleted_at: deletedAt,
      },
      message: 'クラスを削除しました',
    });
  } catch (error) {
    console.error('Error deleting class:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
