import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

/**
 * チェックアウト/早退処理API
 *
 * POST /api/attendance/checkout
 *
 * Body:
 * {
 *   child_id: string;
 *   date?: string; // YYYY-MM-DD (optional, defaults to today)
 *   is_early_leave?: boolean; // true = 早退, false = 通常の帰宅
 *   note?: string; // 備考 (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 });
    }

    const facility_id = userSession.current_facility_id;
    const user_id = session.user.id;

    // リクエストボディ取得
    const body = await request.json();
    const { child_id, date, is_early_leave, note } = body;

    // バリデーション
    if (!child_id) {
      return NextResponse.json(
        { success: false, error: 'child_id is required' },
        { status: 400 }
      );
    }

    // 日付が指定されていない場合は今日
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 子どもが施設に所属しているか確認
    const { data: child, error: childError } = await supabase
      .from('m_children')
      .select('id, family_name, given_name, facility_id')
      .eq('id', child_id)
      .eq('facility_id', facility_id)
      .eq('enrollment_status', 'enrolled')
      .is('deleted_at', null)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found or not enrolled' },
        { status: 404 }
      );
    }

    // 既存の出席記録を取得
    const { data: attendance, error: attendanceError } = await supabase
      .from('h_attendance')
      .select('id, checked_in_at, checked_out_at, status, note')
      .eq('child_id', child_id)
      .eq('attendance_date', targetDate)
      .is('checked_out_at', null)
      .maybeSingle();

    if (attendanceError) {
      console.error('Failed to fetch attendance record:', attendanceError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch attendance record' },
        { status: 500 }
      );
    }

    if (!attendance) {
      return NextResponse.json(
        { success: false, error: 'No active check-in found for today' },
        { status: 404 }
      );
    }

    if (attendance.checked_out_at) {
      return NextResponse.json(
        { success: false, error: 'Already checked out' },
        { status: 409 }
      );
    }

    const now = new Date();

    // チェックアウト処理
    const { data: updatedAttendance, error: updateError } = await supabase
      .from('h_attendance')
      .update({
        checked_out_at: now.toISOString(),
        check_out_method: 'manual',
        checked_out_by: user_id,
        note: note || attendance.note || null,
      })
      .eq('id', attendance.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to check out:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to check out' },
        { status: 500 }
      );
    }

    // 早退の場合、日次出席予定にメモを追加
    if (is_early_leave) {
      await supabase
        .from('r_daily_attendance')
        .upsert({
          child_id,
          facility_id,
          attendance_date: targetDate,
          status: 'irregular',
          note: note ? `早退: ${note}` : '早退',
          updated_by: user_id,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'child_id,attendance_date'
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        child_id,
        child_name: `${child.family_name} ${child.given_name}`,
        checked_in_at: updatedAttendance.checked_in_at,
        checked_out_at: updatedAttendance.checked_out_at,
        is_early_leave: is_early_leave || false,
        date: targetDate,
        note: note || null,
      },
    });
  } catch (error) {
    console.error('Checkout API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
