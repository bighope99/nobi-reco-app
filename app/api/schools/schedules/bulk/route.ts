import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * PUT /api/schools/schedules/bulk
 * 一括スケジュール更新
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // JWTメタデータから認証情報を取得
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role, current_facility_id } = metadata;

    // 権限チェック（staffは更新不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // facility_admin は current_facility_id が必須（fail-closed）
    if (role === 'facility_admin' && !current_facility_id) {
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

    // ユーザーがアクセスできる施設IDを設定
    const allowedFacilityIds: string[] | null =
      role === 'facility_admin' && current_facility_id
        ? [current_facility_id]
        : null;

    // late_threshold_minutes のバリデーション
    for (const update of body.updates) {
      if (update.late_threshold_minutes !== undefined) {
        if (update.late_threshold_minutes === null || update.late_threshold_minutes === '') {
          return NextResponse.json(
            { success: false, error: 'late_threshold_minutes must be an integer between 0 and 120' },
            { status: 400 }
          );
        }
        const threshold = Number(update.late_threshold_minutes);
        if (!Number.isInteger(threshold) || threshold < 0 || threshold > 120) {
          return NextResponse.json(
            { success: false, error: 'late_threshold_minutes must be an integer between 0 and 120' },
            { status: 400 }
          );
        }
        update.late_threshold_minutes = threshold;
      }
    }

    // 同一学校内の学年重複チェック（既存DBスケジュールを含めて検証）
    {
      // gradesが指定されているupdateの対象schedule_idを収集
      const updateIds = body.updates
        .filter((u: { schedule_id?: string; grades?: string[] }) => u.schedule_id && Array.isArray(u.grades))
        .map((u: { schedule_id: string }) => u.schedule_id);

      if (updateIds.length > 0) {
        // 対象スケジュールのschool_idを取得
        const { data: scheduleInfos } = await supabase
          .from('s_school_schedules')
          .select('id, school_id, grades')
          .in('id', updateIds)
          .is('deleted_at', null);

        if (scheduleInfos && scheduleInfos.length > 0) {
          // 影響を受けるschool_idを収集
          const affectedSchoolIds = [...new Set(scheduleInfos.map((s: { school_id: string }) => s.school_id))];

          // 各school_idの全スケジュールをDBから取得
          const { data: allSchedules } = await supabase
            .from('s_school_schedules')
            .select('id, school_id, grades')
            .in('school_id', affectedSchoolIds)
            .is('deleted_at', null);

          if (allSchedules) {
            // school_id → schedule_id → grades のマップ（DBの現状）
            const schoolGradeMap: Record<string, Record<string, string>> = {};
            for (const s of allSchedules) {
              const schoolId = s.school_id as string;
              if (!schoolGradeMap[schoolId]) schoolGradeMap[schoolId] = {};
              for (const grade of (s.grades as string[])) {
                schoolGradeMap[schoolId][grade] = s.id as string;
              }
            }

            // リクエストの変更をオーバーレイ
            const scheduleToSchool = Object.fromEntries(
              scheduleInfos.map((s: { id: string; school_id: string }) => [s.id, s.school_id])
            );
            for (const update of body.updates) {
              if (!update.schedule_id || !Array.isArray(update.grades)) continue;
              const schoolId = scheduleToSchool[update.schedule_id];
              if (!schoolId) continue;
              if (!schoolGradeMap[schoolId]) schoolGradeMap[schoolId] = {};

              // このschedule_idが既に持っていた学年を一旦削除してからオーバーレイ
              for (const [grade, sid] of Object.entries(schoolGradeMap[schoolId])) {
                if (sid === update.schedule_id) {
                  delete schoolGradeMap[schoolId][grade];
                }
              }
              for (const grade of update.grades) {
                if (schoolGradeMap[schoolId][grade]) {
                  return NextResponse.json(
                    { success: false, error: '同一学校内で学年が重複しています' },
                    { status: 400 }
                  );
                }
                schoolGradeMap[schoolId][grade] = update.schedule_id;
              }
            }
          }
        }
      }
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
        if (allowedFacilityIds && allowedFacilityIds.length > 0) {
          const schoolData = schedule.m_schools as { facility_id: string } | { facility_id: string }[] | null;
        const scheduleFacilityId = (Array.isArray(schoolData) ? schoolData[0]?.facility_id : schoolData?.facility_id) ?? '';
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

        if (update.late_threshold_minutes !== undefined) {
          updateData.late_threshold_minutes = update.late_threshold_minutes;
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
