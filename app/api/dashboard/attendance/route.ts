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

    // child_idが施設に所属しているか検証
    const { data: childValidation, error: childError } = await supabase
      .from('m_children')
      .select('id')
      .eq('id', child_id)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .maybeSingle();

    if (childError || !childValidation) {
      return NextResponse.json({
        success: false,
        error: 'Child not found or access denied'
      }, { status: 403 });
    }

    // 並列でデータ取得
    const [
      { data: dailyRecord, error: dailyError },
      { data: openAttendance, error: attendanceFetchError }
    ] = await Promise.all([
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

    if (dailyError) {
      console.error('Daily attendance fetch error:', dailyError);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
    if (attendanceFetchError) {
      console.error('Attendance fetch error:', attendanceFetchError);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
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
      const now = new Date();
      if (action_timestamp) {
        const parsed = new Date(action_timestamp);
        const diffMinutes = Math.abs(now.getTime() - parsed.getTime()) / 60000;

        // ±5分以内のみ許可
        if (!isNaN(parsed.getTime()) && diffMinutes <= 5) {
          return parsed.toISOString();
        }
      }
      return now.toISOString();
    })();

    if (actionType === 'check_in') {
      if (openAttendance) {
        return NextResponse.json({ success: false, error: 'Already checked in today' }, { status: 409 });
      }

      const { error: insertError } = await supabase
        .from('h_attendance')
        .insert({
          child_id,
          facility_id: facilityId,
          checked_in_at: resolvedTimestamp,
          check_in_method: 'manual',
          checked_in_by: session.user.id,
        });

      if (insertError) {
        console.error('Check-in insert error:', insertError);
        return NextResponse.json({ success: false, error: 'Failed to record check-in' }, { status: 500 });
      }

      // 手動ボタンでは常にscheduled（irregularはQRコードのみ）
      await upsertDailyAttendance('scheduled');

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
