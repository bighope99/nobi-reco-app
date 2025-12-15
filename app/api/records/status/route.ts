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

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const facility_id = userSession.current_facility_id;

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const class_id = searchParams.get('class_id') || null;
    const search = searchParams.get('search') || null;
    const warning_only = searchParams.get('warning_only') === 'true';

    // バリデーション
    if (year < 1900 || year > 2100 || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }

    // 期間計算
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const daysInMonth = endDate.getDate();

    // 年初
    const yearStartStr = `${year}-01-01`;
    const today = new Date().toISOString().split('T')[0];

    // 1. 子ども一覧取得
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

    const { data: childrenData, error: childrenError } = await childrenQuery;

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    if (!childrenData || childrenData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period: {
            year,
            month,
            start_date: startDateStr,
            end_date: endDateStr,
            days_in_month: daysInMonth,
          },
          children: [],
          summary: {
            total_children: 0,
            warning_children: 0,
            average_record_rate: 0,
          },
          filters: {
            classes: [],
          },
        },
      });
    }

    const childIds = childrenData.map((c: any) => c.id);

    // 2. 月間出席ログ取得
    const { data: monthlyAttendanceData } = await supabase
      .from('h_attendance')
      .select('child_id, checked_in_at, checked_out_at')
      .in('child_id', childIds)
      .gte('checked_in_at', `${startDateStr}T00:00:00`)
      .lte('checked_in_at', `${endDateStr}T23:59:59`);

    // 3. 月間記録取得
    const { data: monthlyObservationsData } = await supabase
      .from('r_observation')
      .select('child_id, observation_date')
      .in('child_id', childIds)
      .gte('observation_date', startDateStr)
      .lte('observation_date', endDateStr)
      .is('deleted_at', null);

    // 4. 年間出席ログ取得
    const { data: yearlyAttendanceData } = await supabase
      .from('h_attendance')
      .select('child_id, checked_in_at')
      .in('child_id', childIds)
      .gte('checked_in_at', `${yearStartStr}T00:00:00`)
      .lte('checked_in_at', `${today}T23:59:59`);

    // 5. 年間記録取得
    const { data: yearlyObservationsData } = await supabase
      .from('r_observation')
      .select('child_id, observation_date')
      .in('child_id', childIds)
      .gte('observation_date', yearStartStr)
      .lte('observation_date', today)
      .is('deleted_at', null);

    // データ整形
    const children = childrenData.map((child: any) => {
      // 現在所属中のクラスのみを取得
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classInfo = currentClass?.m_classes;

      // 月間統計
      const monthlyAttendances = (monthlyAttendanceData || []).filter((a: any) => a.child_id === child.id);
      const monthlyAttendanceDates = new Set(
        monthlyAttendances.map((a: any) => new Date(a.checked_in_at).toISOString().split('T')[0])
      );
      const monthlyAttendanceCount = monthlyAttendanceDates.size;

      const monthlyObservations = (monthlyObservationsData || []).filter((o: any) => o.child_id === child.id);
      const monthlyObservationDates = new Set(monthlyObservations.map((o: any) => o.observation_date));
      const monthlyRecordCount = monthlyObservationDates.size;

      const monthlyRecordRate = monthlyAttendanceCount > 0
        ? Math.round((monthlyRecordCount / monthlyAttendanceCount) * 100 * 10) / 10
        : 0;

      // 最終記録日
      const lastRecordDate = monthlyObservations.length > 0
        ? monthlyObservations.sort((a: any, b: any) => b.observation_date.localeCompare(a.observation_date))[0].observation_date
        : null;

      const isRecordedToday = lastRecordDate === today;

      // 日別記録ステータス（1日〜月末）
      const dailyStatus: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = new Date(year, month - 1, day).toISOString().split('T')[0];
        const isAttended = monthlyAttendanceDates.has(dateStr);
        const isRecorded = monthlyObservationDates.has(dateStr);

        if (isRecorded && isAttended) {
          dailyStatus.push('present');
        } else if (isAttended && !isRecorded) {
          dailyStatus.push('late');
        } else if (!isAttended) {
          dailyStatus.push('absent');
        } else {
          dailyStatus.push('none');
        }
      }

      // 年間統計
      const yearlyAttendances = (yearlyAttendanceData || []).filter((a: any) => a.child_id === child.id);
      const yearlyAttendanceDates = new Set(
        yearlyAttendances.map((a: any) => new Date(a.checked_in_at).toISOString().split('T')[0])
      );
      const yearlyAttendanceCount = yearlyAttendanceDates.size;

      const yearlyObservations = (yearlyObservationsData || []).filter((o: any) => o.child_id === child.id);
      const yearlyObservationDates = new Set(yearlyObservations.map((o: any) => o.observation_date));
      const yearlyRecordCount = yearlyObservationDates.size;

      const yearlyRecordRate = yearlyAttendanceCount > 0
        ? Math.round((yearlyRecordCount / yearlyAttendanceCount) * 100 * 10) / 10
        : 0;

      // 学年計算
      const grade = child.birth_date ? calculateGrade(child.birth_date, child.grade_add || 0) : '';

      return {
        child_id: child.id,
        name: `${child.family_name} ${child.given_name}`,
        kana: `${child.family_name_kana} ${child.given_name_kana}`,
        class_id: classInfo?.id || null,
        class_name: classInfo?.name || '',
        age_group: grade, // 学年計算結果を返す
        photo_url: child.photo_url,
        last_record_date: lastRecordDate,
        is_recorded_today: isRecordedToday,
        monthly: {
          attendance_count: monthlyAttendanceCount,
          record_count: monthlyRecordCount,
          record_rate: monthlyRecordRate,
          daily_status: dailyStatus,
        },
        yearly: {
          attendance_count: yearlyAttendanceCount,
          record_count: yearlyRecordCount,
          record_rate: yearlyRecordRate,
        },
      };
    });

    // warning_onlyフィルター適用
    const filteredChildren = warning_only
      ? children.filter(c => c.monthly.record_rate < 80)
      : children;

    // サマリー計算
    const warningChildren = children.filter(c => c.monthly.record_rate < 80).length;
    const averageRecordRate = children.length > 0
      ? Math.round((children.reduce((sum, c) => sum + c.monthly.record_rate, 0) / children.length) * 10) / 10
      : 0;

    // クラス一覧（フィルター用）
    const { data: classesData } = await supabase
      .from('m_classes')
      .select('id, name')
      .eq('facility_id', facility_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    const filters = {
      classes: (classesData || []).map((cls: any) => ({
        class_id: cls.id,
        class_name: cls.name,
      })),
    };

    // レスポンス構築
    const response = {
      success: true,
      data: {
        period: {
          year,
          month,
          start_date: startDateStr,
          end_date: endDateStr,
          days_in_month: daysInMonth,
        },
        children: filteredChildren,
        summary: {
          total_children: children.length,
          warning_children: warningChildren,
          average_record_rate: averageRecordRate,
        },
        filters,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Records Status API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
