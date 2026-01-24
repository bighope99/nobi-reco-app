import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { getCurrentDateJST } from '@/lib/utils/timezone';

interface ScheduleUpdate {
  child_id: string;
  schedule: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface BulkUpdateRequest {
  updates: ScheduleUpdate[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // セッションからfacility_idを取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found in session' },
        { status: 400 }
      );
    }

    const facility_id = userSession.current_facility_id;

    // リクエストボディをパース
    const body: BulkUpdateRequest = await request.json();

    if (!body.updates || !Array.isArray(body.updates)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: updates array is required' },
        { status: 400 }
      );
    }

    const results: Array<{ child_id: string; status: 'success' | 'failed'; error?: string }> = [];
    let updated_count = 0;
    let failed_count = 0;

    // 各児童の予定を更新
    for (const update of body.updates) {
      try {
        const { child_id, schedule } = update;

        // 児童が自施設に所属しているか確認
        const { data: child, error: childError } = await supabase
          .from('m_children')
          .select('id')
          .eq('id', child_id)
          .eq('facility_id', facility_id)
          .is('deleted_at', null)
          .single();

        if (childError || !child) {
          results.push({
            child_id,
            status: 'failed',
            error: 'Child not found or access denied',
          });
          failed_count++;
          continue;
        }

        // 既存のスケジュールを確認
        const { data: existingSchedule } = await supabase
          .from('s_attendance_schedule')
          .select('id')
          .eq('child_id', child_id)
          .maybeSingle();

        if (existingSchedule) {
          // 更新
          const { error: updateError } = await supabase
            .from('s_attendance_schedule')
            .update({
              monday: schedule.monday,
              tuesday: schedule.tuesday,
              wednesday: schedule.wednesday,
              thursday: schedule.thursday,
              friday: schedule.friday,
              saturday: schedule.saturday,
              sunday: schedule.sunday,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSchedule.id);

          if (updateError) {
            console.error('Update error:', updateError);
            results.push({
              child_id,
              status: 'failed',
              error: updateError.message,
            });
            failed_count++;
          } else {
            results.push({ child_id, status: 'success' });
            updated_count++;
          }
        } else {
          // 新規作成
          const { error: insertError } = await supabase
            .from('s_attendance_schedule')
            .insert({
              child_id,
              monday: schedule.monday,
              tuesday: schedule.tuesday,
              wednesday: schedule.wednesday,
              thursday: schedule.thursday,
              friday: schedule.friday,
              saturday: schedule.saturday,
              sunday: schedule.sunday,
              valid_from: getCurrentDateJST(), // 今日から有効
              is_active: true,
            });

          if (insertError) {
            console.error('Insert error:', insertError);
            results.push({
              child_id,
              status: 'failed',
              error: insertError.message,
            });
            failed_count++;
          } else {
            results.push({ child_id, status: 'success' });
            updated_count++;
          }
        }
      } catch (err) {
        console.error('Error processing update for child:', update.child_id, err);
        results.push({
          child_id: update.child_id,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        failed_count++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updated_count,
        failed_count,
        results,
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
