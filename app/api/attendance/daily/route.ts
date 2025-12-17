import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

interface UpdateDailyAttendanceRequest {
  child_id: string;
  date: string;
  status: 'scheduled' | 'absent';
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
    const body: UpdateDailyAttendanceRequest = await request.json();

    if (!body.child_id || !body.date || !body.status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: child_id, date, status' },
        { status: 400 }
      );
    }

    // 児童が自施設に所属しているか確認
    const { data: child, error: childError } = await supabase
      .from('m_children')
      .select('id')
      .eq('id', body.child_id)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found or access denied' },
        { status: 404 }
      );
    }

    // r_daily_attendanceにupsert
    const { error: upsertError } = await supabase
      .from('r_daily_attendance')
      .upsert({
        child_id: body.child_id,
        facility_id,
        attendance_date: body.date,
        status: body.status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'child_id,facility_id,attendance_date'
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      return NextResponse.json(
        { success: false, error: 'Failed to update attendance status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        child_id: body.child_id,
        date: body.date,
        status: body.status,
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
