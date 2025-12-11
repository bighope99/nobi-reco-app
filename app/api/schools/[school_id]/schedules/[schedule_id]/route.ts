import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * PUT /api/schools/:school_id/schedules/:schedule_id
 * スケジュール更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { school_id: string; schedule_id: string } }
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

    const { school_id, schedule_id } = params;

    // スケジュールの存在確認
    const { data: schedule, error: scheduleError } = await supabase
      .from('s_school_schedules')
      .select('id, school_id, m_schools!inner(facility_id)')
      .eq('id', schedule_id)
      .eq('school_id', school_id)
      .is('deleted_at', null)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (
      userData.role === 'facility_admin' ||
      userData.role === 'staff'
    ) {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const facilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
      const scheduleFacilityId = (schedule.m_schools as any).facility_id;
      if (!facilityIds.includes(scheduleFacilityId)) {
        return NextResponse.json(
          { success: false, error: 'Schedule not found' },
          { status: 404 }
        );
      }
    }

    const body = await request.json();

    // バリデーション
    if (body.grades && (!Array.isArray(body.grades) || body.grades.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Grades must be a non-empty array' },
        { status: 400 }
      );
    }

    // スケジュール更新
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.grades) {
      updateData.grades = body.grades;
    }

    if (body.weekday_times) {
      updateData.monday_time = body.weekday_times.monday !== undefined
        ? body.weekday_times.monday
        : undefined;
      updateData.tuesday_time = body.weekday_times.tuesday !== undefined
        ? body.weekday_times.tuesday
        : undefined;
      updateData.wednesday_time = body.weekday_times.wednesday !== undefined
        ? body.weekday_times.wednesday
        : undefined;
      updateData.thursday_time = body.weekday_times.thursday !== undefined
        ? body.weekday_times.thursday
        : undefined;
      updateData.friday_time = body.weekday_times.friday !== undefined
        ? body.weekday_times.friday
        : undefined;
      updateData.saturday_time = body.weekday_times.saturday !== undefined
        ? body.weekday_times.saturday
        : undefined;
      updateData.sunday_time = body.weekday_times.sunday !== undefined
        ? body.weekday_times.sunday
        : undefined;
    }

    const { data: updatedSchedule, error: updateError } = await supabase
      .from('s_school_schedules')
      .update(updateData)
      .eq('id', schedule_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        schedule_id: updatedSchedule.id,
        updated_at: updatedSchedule.updated_at,
      },
      message: 'スケジュールを更新しました',
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
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
 * DELETE /api/schools/:school_id/schedules/:schedule_id
 * スケジュール削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { school_id: string; schedule_id: string } }
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

    const { school_id, schedule_id } = params;

    // スケジュールの存在確認
    const { data: schedule, error: scheduleError } = await supabase
      .from('s_school_schedules')
      .select('id, school_id, m_schools!inner(facility_id)')
      .eq('id', schedule_id)
      .eq('school_id', school_id)
      .is('deleted_at', null)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (
      userData.role === 'facility_admin' ||
      userData.role === 'staff'
    ) {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const facilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
      const scheduleFacilityId = (schedule.m_schools as any).facility_id;
      if (!facilityIds.includes(scheduleFacilityId)) {
        return NextResponse.json(
          { success: false, error: 'Schedule not found' },
          { status: 404 }
        );
      }
    }

    const deletedAt = new Date().toISOString();

    // スケジュール削除（ソフトデリート）
    const { error: deleteError } = await supabase
      .from('s_school_schedules')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('id', schedule_id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      data: {
        schedule_id: schedule_id,
        deleted_at: deletedAt,
      },
      message: 'スケジュールを削除しました',
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
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
