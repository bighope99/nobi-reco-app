import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { fetchAttendanceContext, isScheduledForDate } from '../../attendance/utils/attendance';

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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const class_id = searchParams.get('class_id') || null;

    // 現在時刻
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm
    const currentDate = date;

    // 1. 出席リスト取得（子ども一覧 + 出席予定 + 実績）
    let attendanceQuery = supabase
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
        parent_phone,
        school_id,
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
      .eq('_child_class.is_current', true)
      .is('deleted_at', null);

    if (class_id) {
      attendanceQuery = attendanceQuery.eq('_child_class.class_id', class_id);
    }

    const { data: childrenDataRaw, error: childrenError } = await attendanceQuery;

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    const childrenData = childrenDataRaw ?? [];
    const childIds = childrenData.map((c: any) => c.id);

    // 事前計算: 学校ID一覧
    const schoolIds = Array.from(new Set(childrenData
      .map((c: any) => c.school_id)
      .filter((id: string | null) => Boolean(id)))) as string[];

    // 週間記録数計算用の日付
    const oneWeekAgo = new Date(date);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    // 並列でデータ取得（パフォーマンス最適化）
    const [
      attendanceContext,
      schoolScheduleResult,
      observationsResult,
      classesResult
    ] = await Promise.all([
      // 1. 通所予定・当日設定・実績を取得
      fetchAttendanceContext(supabase, facility_id, date, childIds),

      // 2. 学校別登校時刻を取得
      schoolIds.length > 0
        ? supabase
            .from('s_school_schedules')
            .select('school_id, grades, monday_time, tuesday_time, wednesday_time, thursday_time, friday_time, saturday_time, sunday_time')
            .in('school_id', schoolIds)
            .is('deleted_at', null)
        : Promise.resolve({ data: [], error: null }),

      // 3. 記録情報を取得（最終記録日、週間記録数）
      childIds.length > 0
        ? supabase
            .from('r_observation')
            .select('child_id, observation_date')
            .in('child_id', childIds)
            .gte('observation_date', oneWeekAgoStr)
            .is('deleted_at', null)
        : Promise.resolve({ data: [], error: null }),

      // 4. クラス一覧を取得（フィルター用）
      supabase
        .from('m_classes')
        .select('id, name')
        .eq('facility_id', facility_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name'),
    ]);

    const { dayOfWeekKey, schedulePatterns, dailyAttendanceData, attendanceLogsData } = attendanceContext;

    // エラーチェック
    if (schoolScheduleResult.error) {
      console.error('School schedule fetch error:', schoolScheduleResult.error);
      return NextResponse.json({ error: 'Failed to fetch school schedules' }, { status: 500 });
    }

    // データ構造最適化: O(n)検索をO(1)に変換するためMapを使用
    const schedulePatternMap = new Map(
      (schedulePatterns || []).map((s: any) => [s.child_id, s])
    );

    const dailyAttendanceMap = new Map(
      (dailyAttendanceData || []).map((r: any) => [r.child_id, r])
    );

    // attendanceLogsは1子どもに対して複数ログがあるためグループ化
    const attendanceLogsMap = new Map<string, any[]>();
    for (const log of attendanceLogsData || []) {
      const existing = attendanceLogsMap.get(log.child_id) || [];
      existing.push(log);
      attendanceLogsMap.set(log.child_id, existing);
    }

    // observationsも1子どもに対して複数あるためグループ化
    const observationsMap = new Map<string, any[]>();
    for (const obs of observationsResult.data || []) {
      const existing = observationsMap.get(obs.child_id) || [];
      existing.push(obs);
      observationsMap.set(obs.child_id, existing);
    }

    // 学校スケジュールをschool_idでグループ化
    const schoolSchedules: Record<string, any[]> = {};
    for (const schedule of schoolScheduleResult.data || []) {
      if (!schoolSchedules[schedule.school_id]) {
        schoolSchedules[schedule.school_id] = [];
      }
      schoolSchedules[schedule.school_id].push(schedule);
    }

    // データ整形
    type AttendanceListItem = {
      child_id: string;
      name: string;
      kana: string;
      class_id: string | null;
      class_name: string;
      age_group: string;
      grade: number | null;
      grade_label: string;
      photo_url: string | null;
      status: 'checked_in' | 'checked_out' | 'absent';
      is_scheduled_today: boolean;
      scheduled_start_time: string | null;
      scheduled_end_time: string | null;
      actual_in_time: string | null;
      actual_out_time: string | null;
      guardian_phone: string;
      last_record_date: string | null;
      weekly_record_count: number;
    };

    const getSchoolStartTime = (schoolId: string | null, grade: number | null) => {
      if (!schoolId || grade === null || grade === undefined) return null;
      const schedules = schoolSchedules[schoolId] || [];
      const gradeKey = String(grade);
      const matchedSchedule = schedules.find((schedule: any) => (schedule.grades || []).includes(gradeKey));
      if (!matchedSchedule) return null;
      const weekdayKey = `${dayOfWeekKey}_time`;
      return matchedSchedule[weekdayKey as keyof typeof matchedSchedule] || null;
    };

    const formatTimeToMinutes = (time: string | null) => {
      if (!time) return null;
      const [hours, minutes] = time.split(':');
      return `${hours}:${minutes}`;
    };

    const attendanceList: AttendanceListItem[] = childrenData.map((child: any) => {
      // 現在所属中のクラスのみを取得
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classInfo = currentClass?.m_classes;

      // Mapから O(1) でデータ取得（パフォーマンス最適化）
      const schedulePattern = schedulePatternMap.get(child.id);
      const dailyRecord = dailyAttendanceMap.get(child.id);
      const isScheduledToday = isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey);

      // 出席ログも O(1) で取得
      const todaysLogs = attendanceLogsMap.get(child.id) || [];
      const activeLog = todaysLogs.find((log: any) => !log.checked_out_at);
      const latestClosedLog = todaysLogs
        .filter((log: any) => log.checked_out_at)
        .sort((a: any, b: any) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime())[0];
      const displayLog = activeLog || latestClosedLog;

      const grade = calculateGrade(child.birth_date, child.grade_add);
      const gradeLabel = formatGradeLabel(grade);

      const scheduledStartTime = isScheduledToday ? getSchoolStartTime(child.school_id, grade) : null;

      // 記録情報も O(1) で取得
      const childObservations = observationsMap.get(child.id) || [];
      const lastRecordDate = childObservations.length > 0
        ? childObservations.sort((a: any, b: any) => b.observation_date.localeCompare(a.observation_date))[0].observation_date
        : null;
      const weeklyRecordCount = childObservations.length;

      // ステータス判定
      let status: 'checked_in' | 'checked_out' | 'absent' = 'absent';
      if (activeLog) {
        status = 'checked_in';
      } else if (latestClosedLog) {
        status = 'checked_out';
      }

      if (!activeLog && !latestClosedLog && dailyRecord?.status === 'absent') {
        status = 'absent';
      }

      return {
        child_id: child.id,
        name: `${child.family_name} ${child.given_name}`,
        kana: `${child.family_name_kana} ${child.given_name_kana}`,
        class_id: classInfo?.id || null,
        class_name: classInfo?.name || '',
        age_group: classInfo?.age_group || '',
        grade,
        grade_label: gradeLabel,
        photo_url: child.photo_url,
        status,
        is_scheduled_today: isScheduledToday,
        scheduled_start_time: formatTimeToMinutes(scheduledStartTime),
        scheduled_end_time: formatTimeToMinutes(null),
        actual_in_time: displayLog?.checked_in_at ? new Date(displayLog.checked_in_at).toTimeString().slice(0, 5) : null,
        actual_out_time: displayLog?.checked_out_at ? new Date(displayLog.checked_out_at).toTimeString().slice(0, 5) : null,
        guardian_phone: child.parent_phone,
        last_record_date: lastRecordDate,
        weekly_record_count: weeklyRecordCount,
      };
    });

    // KPI計算
    const scheduledToday = attendanceList.filter(c => c.is_scheduled_today).length;
    const presentNow = attendanceList.filter(c => c.status === 'checked_in').length;
    const notArrived = attendanceList.filter(c => c.is_scheduled_today && c.status === 'absent').length;
    const checkedOut = attendanceList.filter(c => c.status === 'checked_out').length;

    // アラート判定
    const getMinutesDiff = (current: string, target: string) => {
      if (!target) return 0;
      const [h1, m1] = current.split(':').map(Number);
      const [h2, m2] = target.split(':').map(Number);
      return (h1 * 60 + m1) - (h2 * 60 + m2);
    };

    const overdue = attendanceList
      .filter(c => {
        if (c.status !== 'checked_in' || !c.is_scheduled_today || !c.scheduled_end_time) return false;
        return getMinutesDiff(currentTime, c.scheduled_end_time) >= 30;
      })
      .map(c => ({
        child_id: c.child_id,
        name: c.name,
        kana: c.kana,
        class_name: c.class_name,
        age_group: c.age_group,
        scheduled_end_time: c.scheduled_end_time,
        actual_in_time: c.actual_in_time,
        minutes_overdue: getMinutesDiff(currentTime, c.scheduled_end_time || ''),
        guardian_phone: c.guardian_phone,
      }));

    const late = attendanceList
      .filter(c => {
        if (c.status !== 'absent' || !c.is_scheduled_today || !c.scheduled_start_time) return false;
        return getMinutesDiff(currentTime, c.scheduled_start_time) > 0;
      })
      .map(c => ({
        child_id: c.child_id,
        name: c.name,
        kana: c.kana,
        class_name: c.class_name,
        age_group: c.age_group,
        scheduled_start_time: c.scheduled_start_time,
        minutes_late: getMinutesDiff(currentTime, c.scheduled_start_time || ''),
        guardian_phone: c.guardian_phone,
      }));

    const unexpected = attendanceList
      .filter(c => c.status === 'checked_in' && !c.is_scheduled_today)
      .map(c => ({
        child_id: c.child_id,
        name: c.name,
        kana: c.kana,
        class_name: c.class_name,
        age_group: c.age_group,
        actual_in_time: c.actual_in_time,
      }));

    // 記録サポート候補
    const getDaysDiff = (date1: string, date2: string | null) => {
      if (!date2) return 999;
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    };

    const recordSupport = attendanceList
      .filter(c => {
        const daysSince = getDaysDiff(date, c.last_record_date);
        return daysSince >= 7 || c.weekly_record_count < 2;
      })
      .map(c => {
        const daysSince = getDaysDiff(date, c.last_record_date);
        let reason = '';
        if (daysSince >= 7) reason = `${daysSince}日間未記録`;
        else if (c.weekly_record_count < 2) reason = '週間記録が少ない';
        return {
          child_id: c.child_id,
          name: c.name,
          kana: c.kana,
          class_name: c.class_name,
          last_record_date: c.last_record_date,
          days_since_record: daysSince,
          weekly_record_count: c.weekly_record_count,
          reason,
        };
      });

    // クラス一覧（フィルター用）- 並列取得済みのclassesResultを使用
    const filters = {
      classes: (classesResult.data || []).map((cls: any) => ({
        class_id: cls.id,
        class_name: cls.name,
      })),
    };

    // レスポンス構築
    const response = {
      success: true,
      data: {
        current_time: currentTime,
        current_date: currentDate,
        kpi: {
          scheduled_today: scheduledToday,
          present_now: presentNow,
          not_arrived: notArrived,
          checked_out: checkedOut,
        },
        alerts: {
          overdue,
          late,
          unexpected,
        },
        attendance_list: attendanceList,
        record_support: recordSupport,
        filters,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
