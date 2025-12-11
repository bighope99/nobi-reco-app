import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * PUT /api/schools/schedules/bulk
 * 一括スケジュール更新
 */
export async function PUT(request: NextRequest) {
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

    const body = await request.json();

    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { success: false, error: 'Updates array is required' },
        { status: 400 }
      );
    }

    // ユーザーがアクセスできる施設IDを取得
    let allowedFacilityIds: string[] = [];
    if (
      userData.role === 'facility_admin' ||
      userData.role === 'staff'
    ) {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      allowedFacilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
    }

    const results = [];
    let updatedCount = 0;
    let failedCount = 0;

    // 各スケジュールを個別に更新
    for (const update of body.updates) {
      try {
        if (!update.schedule_id) {
          results.push({
            schedule_id: null,
            status: 'failed',
            error: 'Schedule ID is required',
          });
          failedCount++;
          continue;
        }

        // スケジュールの存在確認と権限チェック
        const { data: schedule, error: scheduleError } = await supabase
          .from('s_school_schedules')
          .select('id, school_id, m_schools!inner(facility_id)')
          .eq('id', update.schedule_id)
          .is('deleted_at', null)
          .single();

        if (scheduleError || !schedule) {
          results.push({
            schedule_id: update.schedule_id,
            status: 'failed',
            error: 'Schedule not found',
          });
          failedCount++;
          continue;
        }

        // 施設アクセス権限チェック
        if (allowedFacilityIds.length > 0) {
          const scheduleFacilityId = (schedule.m_schools as any).facility_id;
          if (!allowedFacilityIds.includes(scheduleFacilityId)) {
            results.push({
              schedule_id: update.schedule_id,
              status: 'failed',
              error: 'Permission denied',
            });
            failedCount++;
            continue;
          }
        }

        // 更新データを準備
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (update.grades) {
          if (!Array.isArray(update.grades) || update.grades.length === 0) {
            results.push({
              schedule_id: update.schedule_id,
              status: 'failed',
              error: 'Grades must be a non-empty array',
            });
            failedCount++;
            continue;
          }
          updateData.grades = update.grades;
        }

        if (update.weekday_times) {
          updateData.monday_time = update.weekday_times.monday !== undefined
            ? update.weekday_times.monday
            : undefined;
          updateData.tuesday_time = update.weekday_times.tuesday !== undefined
            ? update.weekday_times.tuesday
            : undefined;
          updateData.wednesday_time = update.weekday_times.wednesday !== undefined
            ? update.weekday_times.wednesday
            : undefined;
          updateData.thursday_time = update.weekday_times.thursday !== undefined
            ? update.weekday_times.thursday
            : undefined;
          updateData.friday_time = update.weekday_times.friday !== undefined
            ? update.weekday_times.friday
            : undefined;
          updateData.saturday_time = update.weekday_times.saturday !== undefined
            ? update.weekday_times.saturday
            : undefined;
          updateData.sunday_time = update.weekday_times.sunday !== undefined
            ? update.weekday_times.sunday
            : undefined;
        }

        // 更新実行
        const { error: updateError } = await supabase
          .from('s_school_schedules')
          .update(updateData)
          .eq('id', update.schedule_id);

        if (updateError) {
          throw updateError;
        }

        results.push({
          schedule_id: update.schedule_id,
          status: 'success',
        });
        updatedCount++;
      } catch (error) {
        results.push({
          schedule_id: update.schedule_id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updated_count: updatedCount,
        failed_count: failedCount,
        results: results,
      },
      message: 'スケジュールを一括更新しました',
    });
  } catch (error) {
    console.error('Error bulk updating schedules:', error);
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
