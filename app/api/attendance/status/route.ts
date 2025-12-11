import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

/**
 * 出席ステータスを更新するAPI
 *
 * POST /api/attendance/status
 *
 * Body:
 * {
 *   child_id: string;
 *   status: 'present' | 'late' | 'absent';
 *   date?: string; // YYYY-MM-DD (optional, defaults to today)
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
    const { child_id, status, date, note } = body;

    // バリデーション
    if (!child_id || !status) {
      return NextResponse.json(
        { success: false, error: 'child_id and status are required' },
        { status: 400 }
      );
    }

    if (!['present', 'late', 'absent'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be present, late, or absent' },
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

    const now = new Date();

    // 欠席の場合
    if (status === 'absent') {
      // 既存の出席記録を削除（もしあれば）
      const { error: deleteError } = await supabase
        .from('h_attendance')
        .delete()
        .eq('child_id', child_id)
        .eq('attendance_date', targetDate);

      if (deleteError) {
        console.error('Failed to delete attendance record:', deleteError);
      }

      // 日次出席予定にステータスを記録（または更新）
      const { data: dailyAttendance, error: upsertError } = await supabase
        .from('r_daily_attendance')
        .upsert({
          child_id,
          facility_id,
          attendance_date: targetDate,
          status: 'absent',
          note: note || null,
          updated_by: user_id,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'child_id,attendance_date'
        })
        .select()
        .single();

      if (upsertError) {
        console.error('Failed to update daily attendance:', upsertError);
        return NextResponse.json(
          { success: false, error: 'Failed to mark as absent' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          child_id,
          child_name: `${child.family_name} ${child.given_name}`,
          status: 'absent',
          date: targetDate,
          note: note || null,
        },
      });
    }

    // 出席または遅刻の場合
    // 既存の出席記録をチェック
    const { data: existingAttendance } = await supabase
      .from('h_attendance')
      .select('id, checked_in_at, status')
      .eq('child_id', child_id)
      .eq('attendance_date', targetDate)
      .maybeSingle();

    if (existingAttendance) {
      // 既にチェックイン済みの場合、ステータスのみ更新
      const { data: updatedAttendance, error: updateError } = await supabase
        .from('h_attendance')
        .update({
          status,
          note: note || null,
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update attendance status:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update attendance status' },
          { status: 500 }
        );
      }

      // 日次出席予定も更新
      await supabase
        .from('r_daily_attendance')
        .upsert({
          child_id,
          facility_id,
          attendance_date: targetDate,
          status: status === 'late' ? 'irregular' : 'scheduled',
          note: note || null,
          updated_by: user_id,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'child_id,attendance_date'
        });

      return NextResponse.json({
        success: true,
        data: {
          child_id,
          child_name: `${child.family_name} ${child.given_name}`,
          status,
          checked_in_at: updatedAttendance.checked_in_at,
          date: targetDate,
          note: note || null,
        },
      });
    }

    // 新規チェックイン
    const { data: newAttendance, error: insertError } = await supabase
      .from('h_attendance')
      .insert({
        child_id,
        facility_id,
        attendance_date: targetDate,
        checked_in_at: now.toISOString(),
        check_in_method: 'manual',
        checked_in_by: user_id,
        status,
        note: note || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create attendance record:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to check in' },
        { status: 500 }
      );
    }

    // 日次出席予定も作成/更新
    await supabase
      .from('r_daily_attendance')
      .upsert({
        child_id,
        facility_id,
        attendance_date: targetDate,
        status: status === 'late' ? 'irregular' : 'scheduled',
        note: note || null,
        created_by: user_id,
        updated_by: user_id,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, {
        onConflict: 'child_id,attendance_date'
      });

    return NextResponse.json({
      success: true,
      data: {
        child_id,
        child_name: `${child.family_name} ${child.given_name}`,
        status,
        checked_in_at: newAttendance.checked_in_at,
        date: targetDate,
        note: note || null,
      },
    });
  } catch (error) {
    console.error('Attendance status API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
