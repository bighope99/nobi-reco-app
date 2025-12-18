import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

type AttendanceAction = 'check_in' | 'mark_absent' | 'confirm_unexpected' | 'add_schedule' | 'check_out';

const buildDateRange = (date: string) => {
  return {
    start: `${date}T00:00:00`,
    end: `${date}T23:59:59`,
  };
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { action, child_id, action_timestamp } = await request.json();

    if (!child_id || !action) {
      return NextResponse.json({ success: false, error: 'child_id and action are required' }, { status: 400 });
    }

    if (!['check_in', 'mark_absent', 'confirm_unexpected', 'add_schedule', 'check_out'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    const userSession = await getUserSession(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found in session' }, { status: 400 });
    }

    const facilityId = userSession.current_facility_id;
    const today = new Date();
    const attendanceDate = today.toISOString().split('T')[0];
    const { start, end } = buildDateRange(attendanceDate);

    // 並列実行：日次出席情報と現在のアクティブな出席ログを取得
    const [dailyRecordResult, openAttendanceResult] = await Promise.all([
      supabase
        .from('r_daily_attendance')
        .select('*')
        .eq('child_id', child_id)
        .eq('attendance_date', attendanceDate)
        .maybeSingle(),
      supabase
        .from('h_attendance')
        .select('*')
        .eq('child_id', child_id)
        .eq('facility_id', facilityId)
        .gte('checked_in_at', start)
        .lte('checked_in_at', end)
        .is('checked_out_at', null)
        .maybeSingle()
    ]);

    const { data: dailyRecord, error: dailyError } = dailyRecordResult;
    const { data: openAttendance, error: attendanceFetchError } = openAttendanceResult;

    if (dailyError) {
      console.error('Daily attendance fetch error:', dailyError);
      return NextResponse.json({ success: false, error: 'Failed to fetch daily attendance' }, { status: 500 });
    }

    if (attendanceFetchError) {
      console.error('Attendance fetch error:', attendanceFetchError);
      return NextResponse.json({ success: false, error: 'Failed to fetch attendance logs' }, { status: 500 });
    }

    const upsertDailyAttendance = async (status: 'scheduled' | 'absent' | 'irregular') => {
      if (dailyRecord) {
        const { error: updateError } = await supabase
          .from('r_daily_attendance')
          .update({ status, updated_by: session.user.id })
          .eq('id', dailyRecord.id);

        if (updateError) {
          console.error('Daily attendance update error:', updateError);
          throw new Error('Failed to update daily attendance');
        }
      } else {
        const { error: insertError } = await supabase
          .from('r_daily_attendance')
          .insert({
            child_id,
            facility_id: facilityId,
            attendance_date: attendanceDate,
            status,
            created_by: session.user.id,
            updated_by: session.user.id,
          });

        if (insertError) {
          console.error('Daily attendance insert error:', insertError);
          throw new Error('Failed to register daily attendance');
        }
      }
    };

    const actionType = action as AttendanceAction;
    const resolvedTimestamp = (() => {
      if (action_timestamp) {
        const parsed = new Date(action_timestamp);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString();
        }
      }
      return new Date().toISOString();
    })();

    if (actionType === 'check_in') {
      if (openAttendance) {
        return NextResponse.json({ success: false, error: 'Already checked in today' }, { status: 409 });
      }

      const status: 'scheduled' | 'irregular' = dailyRecord ? 'scheduled' : 'irregular';

      // 並列実行：ログ挿入と日次ステータス更新
      const [insertResult, upsertResult] = await Promise.allSettled([
        supabase
          .from('h_attendance')
          .insert({
            child_id,
            facility_id: facilityId,
            checked_in_at: resolvedTimestamp,
            check_in_method: 'manual',
            checked_in_by: session.user.id,
          }),
        upsertDailyAttendance(status)
      ]);

      const insertError = insertResult.status === 'fulfilled' ? insertResult.value.error : insertResult.reason;
      
      if (insertError) {
        console.error('Check-in insert error:', insertError);
        return NextResponse.json({ success: false, error: 'Failed to record check-in' }, { status: 500 });
      }

      if (upsertResult.status === 'rejected') {
         // ログ挿入が成功しているが、日次更新が失敗した場合のハンドリングが必要ならここに記述
         // 現状はエラーログのみとする
         console.error('Daily attendance upsert failed during check-in:', upsertResult.reason);
      }

      return NextResponse.json({ success: true });
    }

    if (actionType === 'check_out') {
      if (!openAttendance) {
        return NextResponse.json({ success: false, error: 'No active attendance to check out' }, { status: 404 });
      }

      const { error: updateError } = await supabase
        .from('h_attendance')
        .update({
          checked_out_at: resolvedTimestamp,
          check_out_method: 'manual',
          checked_out_by: session.user.id,
        })
        .eq('id', openAttendance.id);

      if (updateError) {
        console.error('Checkout update error:', updateError);
        return NextResponse.json({ success: false, error: 'Failed to record check-out' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    if (actionType === 'mark_absent') {
      if (openAttendance) {
        return NextResponse.json({ success: false, error: 'Child is already checked in' }, { status: 409 });
      }

      await upsertDailyAttendance('absent');
      return NextResponse.json({ success: true });
    }

    if (actionType === 'add_schedule') {
      await upsertDailyAttendance('scheduled');
      return NextResponse.json({ success: true });
    }

    if (actionType === 'confirm_unexpected') {
      if (!openAttendance) {
        return NextResponse.json({ success: false, error: 'No active attendance to confirm' }, { status: 404 });
      }

      await upsertDailyAttendance('irregular');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Unhandled action' }, { status: 400 });
  } catch (error) {
    console.error('Dashboard attendance action error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process attendance action' }, { status: 500 });
  }
}
