import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { fetchAttendanceContext, isScheduledForDate } from '../../attendance/utils/attendance';
import { formatName } from '@/utils/crypto/decryption-helper';
import { cachedBatchDecryptChildren, cachedBatchDecryptGuardianPhones } from '@/utils/crypto/decryption-cache';
import {
  LATE_ARRIVAL_THRESHOLD_MINUTES,
  OVERDUE_DEPARTURE_THRESHOLD_MINUTES,
} from '@/lib/constants/attendance';
import { type LateArrivalAlert, getMinutesDiff } from '@/lib/alerts/late-arrival';
import { formatTimeJST, getCurrentDateJST, getCurrentTimeJST } from '@/lib/utils/timezone';
import type { ChildDataRaw, ChildClassRaw, SchoolSchedule, SchoolInfo, ClassFilter, AttendanceLog } from '../types';

/**
 * Priority Dashboard API
 *
 * 最優先で表示すべきデータのみを返す軽量エンドポイント:
 * - KPI（集計値）
 * - アラート（未帰所・遅刻・予定外）
 * - 要対応リスト（アラート対象 + 未登所の児童）
 * - フィルター用クラス一覧
 *
 * 全員リストは別エンドポイント（/api/dashboard/attendance-list）で取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT署名検証済み）
    const userMetadata = await getAuthenticatedUserMetadata();
    if (!userMetadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userMetadata.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const facility_id = userMetadata.current_facility_id;

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

    const currentTime = getCurrentTimeJST();

    // 1. 子ども一覧取得（最小限のフィールドのみ）
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

    const childrenData = (childrenDataRaw ?? []) as ChildDataRaw[];
    const childIds = childrenData.map((c) => c.id);

    // 学校ID一覧
    const schoolIds = Array.from(
      new Set(childrenData.map((c) => c.school_id).filter((id): id is string => Boolean(id)))
    );

    // 2. 並列でデータ取得
    const [attendanceContext, schoolScheduleResult, schoolsResult, guardianLinksResult, classesResult] =
      await Promise.all([
        // 出席コンテキスト
        fetchAttendanceContext(supabase, facility_id, date, childIds),

        // 学校別登校時刻
        schoolIds.length > 0
          ? supabase
              .from('s_school_schedules')
              .select(
                'school_id, grades, monday_time, tuesday_time, wednesday_time, thursday_time, friday_time, saturday_time, sunday_time'
              )
              .in('school_id', schoolIds)
              .is('deleted_at', null)
          : Promise.resolve({ data: [], error: null }),

        // 学校マスタ
        schoolIds.length > 0
          ? supabase.from('m_schools').select('id, name').in('id', schoolIds).is('deleted_at', null)
          : Promise.resolve({ data: [], error: null }),

        // 保護者連絡先（アラート表示用）
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

        // クラス一覧（フィルター用）
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
    if (schoolsResult.error) {
      console.error('Schools fetch error:', schoolsResult.error);
      return NextResponse.json({ error: 'Failed to fetch schools' }, { status: 500 });
    }
    if (guardianLinksResult.error) {
      console.error('Guardian link fetch error:', guardianLinksResult.error);
      return NextResponse.json({ error: 'Failed to fetch guardian links' }, { status: 500 });
    }
    if (classesResult.error) {
      console.error('Classes fetch error:', classesResult.error);
      return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
    }

    // 3. データ構造最適化: Mapに変換
    const schedulePatternMap = new Map(
      (schedulePatterns || []).map((s: { child_id: string }) => [s.child_id, s])
    );
    const dailyAttendanceMap = new Map(
      (dailyAttendanceData || []).map((r: { child_id: string; status?: string }) => [r.child_id, r])
    );

    // 出席ログをグループ化
    const attendanceLogsMap = new Map<string, AttendanceLog[]>();
    for (const log of (attendanceLogsData || []) as AttendanceLog[]) {
      const existing = attendanceLogsMap.get(log.child_id) || [];
      existing.push(log);
      attendanceLogsMap.set(log.child_id, existing);
    }

    // 学校スケジュールをグループ化
    const schoolSchedules: Record<string, SchoolSchedule[]> = {};
    for (const schedule of (schoolScheduleResult.data || []) as SchoolSchedule[]) {
      if (!schoolSchedules[schedule.school_id]) {
        schoolSchedules[schedule.school_id] = [];
      }
      schoolSchedules[schedule.school_id].push(schedule);
    }

    // 学校名マップ
    const schoolNameMap = new Map<string, string>(
      ((schoolsResult.data || []) as SchoolInfo[]).map((s) => [s.id, s.name])
    );

    // 4. バッチ復号化（電話番号）- 施設IDでキャッシュ分離
    const guardianPhoneMap = cachedBatchDecryptGuardianPhones(guardianLinksResult.data || [], facility_id);

    // 5. ヘルパー関数
    const getSchoolStartTime = (schoolId: string | null, grade: number | null): string | null => {
      if (!schoolId || grade === null || grade === undefined) return null;
      const schedules = schoolSchedules[schoolId] || [];
      const gradeKey = String(grade);
      const matchedSchedule = schedules.find((schedule) =>
        (schedule.grades || []).includes(gradeKey)
      );
      if (!matchedSchedule) return null;
      const weekdayKey = `${dayOfWeekKey}_time` as keyof SchoolSchedule;
      return (matchedSchedule[weekdayKey] as string | null) || null;
    };

    const formatTimeToMinutes = (time: string | null) => {
      if (!time) return null;
      const [hours, minutes] = time.split(':');
      return `${hours}:${minutes}`;
    };

    // 6. KPI集計用の中間データ構築
    type ChildStatusItem = {
      child_id: string;
      child: ChildDataRaw;
      status: 'checked_in' | 'checked_out' | 'absent';
      is_scheduled_today: boolean;
      scheduled_start_time: string | null;
      scheduled_end_time: string | null;
      actual_in_time: string | null;
      actual_out_time: string | null;
      check_in_method: 'qr' | 'manual' | null;
      grade: number | null;
    };

    const childStatuses: ChildStatusItem[] = childrenData.map((child) => {
      const schedulePattern = schedulePatternMap.get(child.id);
      const dailyRecord = dailyAttendanceMap.get(child.id);
      const isScheduledToday = isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey);

      const todaysLogs = attendanceLogsMap.get(child.id) || [];
      const activeLog = todaysLogs.find((log) => !log.checked_out_at);
      const latestClosedLog = todaysLogs
        .filter((log) => log.checked_out_at)
        .sort(
          (a, b) => new Date(b.checked_in_at || '').getTime() - new Date(a.checked_in_at || '').getTime()
        )[0];
      const displayLog = activeLog || latestClosedLog;

      const grade = calculateGrade(child.birth_date, child.grade_add);
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
        child,
        status,
        is_scheduled_today: isScheduledToday,
        scheduled_start_time: formatTimeToMinutes(scheduledStartTime),
        scheduled_end_time: formatTimeToMinutes(null), // TODO: 降園予定時刻の実装
        actual_in_time: formatTimeJST(displayLog?.checked_in_at),
        actual_out_time: formatTimeJST(displayLog?.checked_out_at),
        check_in_method: displayLog?.check_in_method || null,
        grade,
      };
    });

    // 7. KPI計算
    const scheduledToday = childStatuses.filter((c) => c.is_scheduled_today).length;
    const presentNow = childStatuses.filter((c) => c.status === 'checked_in').length;
    const notArrived = childStatuses.filter((c) => c.is_scheduled_today && c.status === 'absent').length;
    const checkedOut = childStatuses.filter((c) => c.status === 'checked_out').length;

    // 8. 要対応の児童を特定（アラート対象 + 未登所）
    const actionRequiredStatuses = childStatuses.filter((c) => {
      // 未帰所（在所中で予定終了時刻超過）
      if (c.status === 'checked_in' && c.is_scheduled_today && c.scheduled_end_time) {
        if (getMinutesDiff(currentTime, c.scheduled_end_time) >= OVERDUE_DEPARTURE_THRESHOLD_MINUTES) {
          return true;
        }
      }
      // 遅刻（未登所で予定開始時刻超過）
      if (c.status === 'absent' && c.is_scheduled_today && c.scheduled_start_time) {
        if (getMinutesDiff(currentTime, c.scheduled_start_time) >= LATE_ARRIVAL_THRESHOLD_MINUTES) {
          return true;
        }
      }
      // 予定外登園
      if (c.status === 'checked_in' && !c.is_scheduled_today && c.check_in_method === 'qr') {
        return true;
      }
      // 未登所（予定ありだが未到着）
      if (c.is_scheduled_today && c.status === 'absent') {
        return true;
      }
      return false;
    });

    // 9. 要対応児童のみバッチ復号化（最適化のポイント）- 施設IDでキャッシュ分離
    const actionRequiredChildren = actionRequiredStatuses.map((s) => s.child);
    const decryptedActionRequired = cachedBatchDecryptChildren(actionRequiredChildren, facility_id);

    // 10. 要対応リスト構築
    type ActionRequiredItem = {
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
      alert_type: 'overdue' | 'late' | 'unexpected' | 'not_arrived' | null;
    };

    const actionRequiredList: ActionRequiredItem[] = actionRequiredStatuses.map((s, index) => {
      const decrypted = decryptedActionRequired[index];
      const currentClass = s.child._child_class?.find((cc: ChildClassRaw) => cc.is_current);
      const classInfo = currentClass?.m_classes;
      const gradeLabel = formatGradeLabel(s.grade);

      // アラートタイプを判定
      let alertType: 'overdue' | 'late' | 'unexpected' | 'not_arrived' | null = null;
      if (s.status === 'checked_in' && s.is_scheduled_today && s.scheduled_end_time) {
        if (getMinutesDiff(currentTime, s.scheduled_end_time) >= OVERDUE_DEPARTURE_THRESHOLD_MINUTES) {
          alertType = 'overdue';
        }
      }
      if (s.status === 'absent' && s.is_scheduled_today && s.scheduled_start_time) {
        if (getMinutesDiff(currentTime, s.scheduled_start_time) >= LATE_ARRIVAL_THRESHOLD_MINUTES) {
          alertType = 'late';
        }
      }
      if (s.status === 'checked_in' && !s.is_scheduled_today && s.check_in_method === 'qr') {
        alertType = 'unexpected';
      }
      if (!alertType && s.is_scheduled_today && s.status === 'absent') {
        alertType = 'not_arrived';
      }

      return {
        child_id: s.child_id,
        name: formatName([decrypted.decrypted_family_name, decrypted.decrypted_given_name]) ?? '',
        kana: formatName([decrypted.decrypted_family_name_kana, decrypted.decrypted_given_name_kana]) ?? '',
        class_id: classInfo?.id || null,
        class_name: classInfo?.name || '',
        age_group: classInfo?.age_group || '',
        grade: s.grade,
        grade_label: gradeLabel,
        school_id: s.child.school_id || null,
        school_name: s.child.school_id ? schoolNameMap.get(s.child.school_id) || null : null,
        photo_url: s.child.photo_url,
        status: s.status,
        is_scheduled_today: s.is_scheduled_today,
        scheduled_start_time: s.scheduled_start_time,
        scheduled_end_time: s.scheduled_end_time,
        actual_in_time: s.actual_in_time,
        actual_out_time: s.actual_out_time,
        check_in_method: s.check_in_method,
        guardian_phone: guardianPhoneMap.get(s.child_id) ?? null,
        alert_type: alertType,
      };
    });

    // 11. アラート構築（詳細情報付き）
    const overdue = actionRequiredList
      .filter((c) => c.alert_type === 'overdue')
      .map((c) => ({
        child_id: c.child_id,
        name: c.name,
        kana: c.kana,
        class_name: c.class_name,
        age_group: c.age_group,
        grade: c.grade,
        grade_label: c.grade_label,
        school_id: c.school_id,
        school_name: c.school_name,
        scheduled_end_time: c.scheduled_end_time,
        actual_in_time: c.actual_in_time,
        minutes_overdue: getMinutesDiff(currentTime, c.scheduled_end_time || ''),
        guardian_phone: c.guardian_phone,
      }));

    const late: LateArrivalAlert[] = actionRequiredList
      .filter((c) => c.alert_type === 'late')
      .map((c) => ({
        child_id: c.child_id,
        name: c.name,
        kana: c.kana,
        class_name: c.class_name,
        age_group: c.age_group,
        grade: c.grade,
        grade_label: c.grade_label,
        school_id: c.school_id,
        school_name: c.school_name,
        scheduled_start_time: c.scheduled_start_time!,
        minutes_late: getMinutesDiff(currentTime, c.scheduled_start_time || ''),
        guardian_phone: c.guardian_phone,
        alert_triggered_at: new Date().toISOString(),
      }));

    const unexpected = actionRequiredList
      .filter((c) => c.alert_type === 'unexpected')
      .map((c) => ({
        child_id: c.child_id,
        name: c.name,
        kana: c.kana,
        class_name: c.class_name,
        age_group: c.age_group,
        actual_in_time: c.actual_in_time,
      }));

    // 12. フィルター用クラス一覧
    const filters = {
      classes: ((classesResult.data || []) as ClassFilter[]).map((cls) => ({
        class_id: cls.id,
        class_name: cls.name,
      })),
    };

    // 13. レスポンス構築
    const response = {
      success: true,
      data: {
        current_time: currentTime,
        current_date: date,
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
        action_required: actionRequiredList,
        filters,
        // 全件数（attendance-list API呼び出しの参考用）
        total_children: childrenData.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Priority Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
