import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/classes/:id
 * クラス詳細取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { id: classId } = params;

    // クラス基本情報取得
    const { data: classData, error: classError } = await supabase
      .from('m_classes')
      .select(
        `
        id,
        name,
        grade,
        school_year,
        capacity,
        is_active,
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
        .eq('is_primary', true);

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
        is_homeroom,
        m_users!inner (
          id,
          name,
          role
        )
      `
      )
      .eq('class_id', classId);

    const staff =
      staffAssignments?.map((sa: any) => ({
        id: sa.m_users.id,
        name: sa.m_users.name,
        role: sa.m_users.role,
        is_homeroom: sa.is_homeroom,
      })) || [];

    // 所属児童取得（中間テーブル経由）
    const { data: childClassAssignments } = await supabase
      .from('_child_class')
      .select(
        `
        m_children!inner (
          id,
          name,
          name_kana,
          birth_date,
          photo_url,
          enrollment_status
        )
      `
      )
      .eq('class_id', classId)
      .eq('is_current', true);

    const children = childClassAssignments?.map((cc: any) => cc.m_children) || [];

    // 在籍児童数カウント
    const currentCount = children?.length || 0;

    return NextResponse.json({
      success: true,
      data: {
        class_id: classData.id,
        name: classData.name,
        grade: classData.grade,
        school_year: classData.school_year,
        capacity: classData.capacity,
        current_count: currentCount,
        is_active: classData.is_active,
        facility_id: classData.facility_id,
        facility_name: (classData.m_facilities as any).name,
        staff: staff,
        children:
          children?.map((child) => ({
            id: child.id,
            name: child.name,
            name_kana: child.name_kana,
            birth_date: child.birth_date,
            age: child.birth_date
              ? Math.floor(
                  (new Date().getTime() - new Date(child.birth_date).getTime()) /
                    (365.25 * 24 * 60 * 60 * 1000)
                )
              : null,
            photo_url: child.photo_url,
            enrollment_status: child.enrollment_status,
          })) || [],
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
  { params }: { params: { id: string } }
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

    const { id: classId } = params;

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
        .eq('is_primary', true);

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
    if (body.grade !== undefined) updateData.grade = body.grade;
    if (body.school_year !== undefined) updateData.school_year = body.school_year;
    if (body.capacity !== undefined) updateData.capacity = body.capacity;
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
  { params }: { params: { id: string } }
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

    const { id: classId } = params;

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
        .eq('is_primary', true);

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
