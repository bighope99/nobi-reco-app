import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

// 学年計算関数（日本の学校制度：4月1日基準）
function calculateGrade(birthDate: string, gradeAdd: number = 0): string {
  const birth = new Date(birthDate);
  const today = new Date();
  const birthMonth = birth.getMonth() + 1; // 1-12
  const birthYear = birth.getFullYear();
  const currentYear = today.getFullYear();

  let grade: number;
  if (birthMonth >= 4) {
    // 4月以降生まれ
    grade = currentYear - birthYear - 6 + 1;
  } else {
    // 1-3月生まれ
    grade = currentYear - birthYear - 6;
  }

  grade += gradeAdd;

  // 1-6年生の範囲チェック
  if (grade < 1 || grade > 6) {
    return ''; // 範囲外の場合は空文字
  }

  return `${grade}年生`;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

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
    const dateParam = searchParams.get('date');
    const class_id = searchParams.get('class_id');
    const statusFilter = searchParams.get('status');
    const search = searchParams.get('search');

    // 対象日（デフォルトは今日）
    const targetDate = dateParam || new Date().toISOString().split('T')[0];

    // 曜日を取得
    const date = new Date(targetDate);
    const dayOfWeek = date.getDay(); // 0=日曜, 1=月曜, ...
    const weekdayMap: { [key: number]: string } = {
      0: 'sunday',
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
      6: 'saturday',
    };
    const weekday = weekdayMap[dayOfWeek];
    const weekdayJp: { [key: string]: string } = {
      sunday: '日',
      monday: '月',
      tuesday: '火',
      wednesday: '水',
      thursday: '木',
      friday: '金',
      saturday: '土',
    };

    // 児童一覧を取得
    let childrenQuery = supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        birth_date,
        grade_add,
        photo_url,
        _child_class (
          class_id,
          is_current,
          m_classes (
            id,
            name,
            age_group
          )
        ),
        s_attendance_schedule (
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          sunday
        )
      `)
      .eq('facility_id', facility_id)
      .eq('enrollment_status', 'enrolled')
      .is('deleted_at', null);

    if (class_id) {
      childrenQuery = childrenQuery.eq('_child_class.class_id', class_id);
    }

    if (search) {
      childrenQuery = childrenQuery.or(`family_name.ilike.%${search}%,given_name.ilike.%${search}%,family_name_kana.ilike.%${search}%,given_name_kana.ilike.%${search}%`);
    }

    const { data: children, error: childrenError } = await childrenQuery;

    if (childrenError) {
      console.error('Database error:', childrenError);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    // 出席記録を取得
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('h_attendance')
      .select('child_id, checked_in_at, checked_out_at, status, scan_method, note')
      .eq('facility_id', facility_id)
      .gte('attendance_date', targetDate)
      .lt('attendance_date', new Date(new Date(targetDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .is('deleted_at', null);

    if (attendanceError) {
      console.error('Attendance error:', attendanceError);
      // エラーでも続行（出席記録がない場合もある）
    }

    // データを整形
    const attendanceMap = new Map();
    (attendanceRecords || []).forEach((record: any) => {
      attendanceMap.set(record.child_id, record);
    });

    const formattedChildren = children.map((child: any) => {
      // 現在所属中のクラスのみを取得
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classData = currentClass?.m_classes;
      const schedule = Array.isArray(child.s_attendance_schedule) && child.s_attendance_schedule.length > 0
        ? child.s_attendance_schedule[0]
        : null;

      const isExpected = schedule ? schedule[weekday] === true : false;
      const attendance = attendanceMap.get(child.id);

      // 学年計算
      const grade = child.birth_date ? calculateGrade(child.birth_date, child.grade_add || 0) : '';

      // ステータス判定
      let status = 'not_arrived';
      let isUnexpected = false;

      if (attendance) {
        if (attendance.checked_in_at) {
          const checkedInTime = new Date(attendance.checked_in_at);
          const hour = checkedInTime.getHours();
          const minute = checkedInTime.getMinutes();

          // 9:30以降をチェックイン遅刻とみなす
          if (hour > 9 || (hour === 9 && minute >= 30)) {
            status = 'late';
          } else {
            status = 'present';
          }

          // 予定外チェック
          if (!isExpected) {
            isUnexpected = true;
          }
        } else if (attendance.status === 'absent') {
          status = 'absent';
        }
      } else if (isExpected) {
        status = 'absent';
      }

      return {
        child_id: child.id,
        name: `${child.family_name} ${child.given_name}`,
        kana: `${child.family_name_kana} ${child.given_name_kana}`,
        class_id: classData?.id || null,
        class_name: classData?.name || '',
        age_group: grade, // 学年計算結果を返す
        photo_url: child.photo_url,
        status,
        is_expected: isExpected,
        checked_in_at: attendance?.checked_in_at || null,
        checked_out_at: attendance?.checked_out_at || null,
        scan_method: attendance?.scan_method || null,
        is_unexpected: isUnexpected,
      };
    });

    // ステータスフィルター適用
    let filteredChildren = formattedChildren;
    if (statusFilter) {
      filteredChildren = formattedChildren.filter((child: any) => child.status === statusFilter);
    }

    // サマリー計算
    const summary = {
      total_children: formattedChildren.length,
      present_count: formattedChildren.filter((c: any) => c.status === 'present').length,
      absent_count: formattedChildren.filter((c: any) => c.status === 'absent').length,
      late_count: formattedChildren.filter((c: any) => c.status === 'late').length,
      not_checked_in_count: formattedChildren.filter((c: any) => c.status === 'not_arrived' && c.is_expected).length,
    };

    // クラス一覧を取得
    const { data: classes } = await supabase
      .from('m_classes')
      .select('id, name')
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .order('display_order');

    const classesWithCounts = (classes || []).map((cls: any) => {
      const classChildren = formattedChildren.filter((c: any) => c.class_id === cls.id);
      return {
        class_id: cls.id,
        class_name: cls.name,
        present_count: classChildren.filter((c: any) => c.status === 'present').length,
        total_count: classChildren.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate,
        weekday,
        weekday_jp: weekdayJp[weekday],
        summary,
        children: filteredChildren,
        filters: {
          classes: classesWithCounts,
        },
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
