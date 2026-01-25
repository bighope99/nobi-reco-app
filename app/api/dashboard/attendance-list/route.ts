import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { fetchAttendanceContext, isScheduledForDate } from '../../attendance/utils/attendance';
import { formatName } from '@/utils/crypto/decryption-helper';
import { cachedBatchDecryptChildren, cachedBatchDecryptGuardianPhones } from '@/utils/crypto/decryption-cache';
import { formatTimeJST, getCurrentDateJST } from '@/lib/utils/timezone';

/**
 * Attendance List API
 *
 * 全児童リストを返すエンドポイント（折りたたみ展開時に使用）
 * - exclude_ids パラメータで特定の児童を除外可能（要対応リスト既取得分）
 * - バッチ復号化で効率的にPIIを復号化
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
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
    const dateParam = searchParams.get('date');
    const date =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getCurrentDateJST();

    const classIdParam = searchParams.get('class_id');
    const class_id =
      classIdParam &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classIdParam)
        ? classIdParam
        : null;

    // 除外するchild_ids（priority APIで既に取得済みの要対応児童）
    const excludeIdsParam = searchParams.get('exclude_ids');
    const excludeIds = excludeIdsParam
      ? excludeIdsParam.split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id))
      : [];

    // 1. 子ども一覧取得
    let childrenQuery = supabase
      .from('m_children')
      .select(
        `
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        birth_date,
        grade_add,
        photo_url,
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
      `
      )
      .eq('facility_id', facility_id)
      .eq('enrollment_status', 'enrolled')
      .eq('_child_class.is_current', true)
      .is('deleted_at', null);

    if (class_id) {
      childrenQuery = childrenQuery.eq('_child_class.class_id', class_id);
    }

    const { data: childrenDataRaw, error: childrenError } = await childrenQuery;

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    // 除外IDを適用
    const excludeIdSet = new Set(excludeIds);
    const childrenData = (childrenDataRaw ?? []).filter((c: any) => !excludeIdSet.has(c.id));
    const childIds = childrenData.map((c: any) => c.id);

    // 学校ID一覧
    const schoolIds = Array.from(
      new Set(childrenData.map((c: any) => c.school_id).filter((id: string | null) => Boolean(id)))
    ) as string[];

    // 2. 並列でデータ取得
    const [attendanceContext, schoolScheduleResult, schoolsResult, guardianLinksResult] =
      await Promise.all([
        fetchAttendanceContext(supabase, facility_id, date, childIds),

        schoolIds.length > 0
          ? supabase
              .from('s_school_schedules')
              .select(
                'school_id, grades, monday_time, tuesday_time, wednesday_time, thursday_time, friday_time, saturday_time, sunday_time'
              )
              .in('school_id', schoolIds)
              .is('deleted_at', null)
          : Promise.resolve({ data: [], error: null }),

        schoolIds.length > 0
          ? supabase.from('m_schools').select('id, name').in('id', schoolIds).is('deleted_at', null)
          : Promise.resolve({ data: [], error: null }),

        childIds.length > 0
          ? supabase
              .from('_child_guardian')
              .select(
                `
                child_id,
                is_primary,
                guardian:m_guardians (
                  id,
                  phone
                )
              `
              )
              .in('child_id', childIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    const { dayOfWeekKey, schedulePatterns, dailyAttendanceData, attendanceLogsData } = attendanceContext;

    // 3. データ構造最適化
    const schedulePatternMap = new Map((schedulePatterns || []).map((s: any) => [s.child_id, s]));
    const dailyAttendanceMap = new Map((dailyAttendanceData || []).map((r: any) => [r.child_id, r]));

    const attendanceLogsMap = new Map<string, any[]>();
    for (const log of attendanceLogsData || []) {
      const existing = attendanceLogsMap.get(log.child_id) || [];
      existing.push(log);
      attendanceLogsMap.set(log.child_id, existing);
    }

    const schoolSchedules: Record<string, any[]> = {};
    for (const schedule of schoolScheduleResult.data || []) {
      if (!schoolSchedules[schedule.school_id]) {
        schoolSchedules[schedule.school_id] = [];
      }
      schoolSchedules[schedule.school_id].push(schedule);
    }

    const schoolNameMap = new Map<string, string>(
      (schoolsResult.data || []).map((s: any) => [s.id, s.name])
    );

    // 4. バッチ復号化 - 施設IDでキャッシュ分離
    const decryptedChildren = cachedBatchDecryptChildren(childrenData, facility_id);
    const guardianPhoneMap = cachedBatchDecryptGuardianPhones(guardianLinksResult.data || [], facility_id);

    // 5. ヘルパー関数
    const getSchoolStartTime = (schoolId: string | null, grade: number | null) => {
      if (!schoolId || grade === null || grade === undefined) return null;
      const schedules = schoolSchedules[schoolId] || [];
      const gradeKey = String(grade);
      const matchedSchedule = schedules.find((schedule: any) =>
        (schedule.grades || []).includes(gradeKey)
      );
      if (!matchedSchedule) return null;
      const weekdayKey = `${dayOfWeekKey}_time`;
      return matchedSchedule[weekdayKey as keyof typeof matchedSchedule] || null;
    };

    const formatTimeToMinutes = (time: string | null) => {
      if (!time) return null;
      const [hours, minutes] = time.split(':');
      return `${hours}:${minutes}`;
    };

    // 6. 出席リスト構築
    type AttendanceListItem = {
      child_id: string;
      name: string;
      kana: string;
      class_id: string | null;
      class_name: string;
      age_group: string;
      grade: number | null;
      grade_label: string;
      school_id: string | null;
      school_name: string | null;
      photo_url: string | null;
      status: 'checked_in' | 'checked_out' | 'absent';
      is_scheduled_today: boolean;
      scheduled_start_time: string | null;
      scheduled_end_time: string | null;
      actual_in_time: string | null;
      actual_out_time: string | null;
      check_in_method: 'qr' | 'manual' | null;
      guardian_phone: string | null;
    };

    const attendanceList: AttendanceListItem[] = decryptedChildren.map((child: any) => {
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classInfo = currentClass?.m_classes;

      const schedulePattern = schedulePatternMap.get(child.id);
      const dailyRecord = dailyAttendanceMap.get(child.id);
      const isScheduledToday = isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey);

      const todaysLogs = attendanceLogsMap.get(child.id) || [];
      const activeLog = todaysLogs.find((log: any) => !log.checked_out_at);
      const latestClosedLog = todaysLogs
        .filter((log: any) => log.checked_out_at)
        .sort(
          (a: any, b: any) => new Date(b.checked_in_at).getTime() - new Date(a.checked_in_at).getTime()
        )[0];
      const displayLog = activeLog || latestClosedLog;

      const grade = calculateGrade(child.birth_date, child.grade_add);
      const gradeLabel = formatGradeLabel(grade);
      const scheduledStartTime = isScheduledToday ? getSchoolStartTime(child.school_id, grade) : null;

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
        name: formatName([child.decrypted_family_name, child.decrypted_given_name]) ?? '',
        kana: formatName([child.decrypted_family_name_kana, child.decrypted_given_name_kana]) ?? '',
        class_id: classInfo?.id || null,
        class_name: classInfo?.name || '',
        age_group: classInfo?.age_group || '',
        grade,
        grade_label: gradeLabel,
        school_id: child.school_id || null,
        school_name: child.school_id ? schoolNameMap.get(child.school_id) || null : null,
        photo_url: child.photo_url,
        status,
        is_scheduled_today: isScheduledToday,
        scheduled_start_time: formatTimeToMinutes(scheduledStartTime),
        scheduled_end_time: formatTimeToMinutes(null),
        actual_in_time: formatTimeJST(displayLog?.checked_in_at),
        actual_out_time: formatTimeJST(displayLog?.checked_out_at),
        check_in_method: displayLog?.check_in_method || null,
        guardian_phone: guardianPhoneMap.get(child.id) ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        attendance_list: attendanceList,
        total: attendanceList.length,
      },
    });
  } catch (error) {
    console.error('Attendance List API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
