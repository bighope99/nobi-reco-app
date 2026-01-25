import { SupabaseClient } from '@supabase/supabase-js';
import { toDateStringJST } from '@/lib/utils/timezone';

type AttendanceContext = {
  dayOfWeekKey: string;
  schedulePatterns: any[];
  dailyAttendanceData: any[];
  attendanceLogsData: any[];
};

const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const weekdayJpMap: Record<string, string> = {
  sunday: '日',
  monday: '月',
  tuesday: '火',
  wednesday: '水',
  thursday: '木',
  friday: '金',
  saturday: '土',
};

const getDateRange = (date: string) => {
  // JSTベースの範囲をUTCに変換（/api/dashboard/attendance/route.tsと同じ方式）
  const start = new Date(`${date}T00:00:00+09:00`).toISOString();
  const end = new Date(`${date}T23:59:59.999+09:00`).toISOString();
  const nextDate = new Date(`${date}T00:00:00+09:00`);
  nextDate.setDate(nextDate.getDate() + 1);

  return {
    start,
    end,
    nextDateString: toDateStringJST(nextDate),
  };
};

// JSTタイムゾーンを考慮した曜日計算
export const getDayOfWeekKey = (date: string) => weekdayKeys[new Date(`${date}T00:00:00+09:00`).getDay()];

export async function fetchAttendanceContext(
  supabase: SupabaseClient,
  facilityId: string,
  date: string,
  childIds: string[]
): Promise<AttendanceContext> {
  const dayOfWeekKey = getDayOfWeekKey(date);

  if (childIds.length === 0) {
    return { dayOfWeekKey, schedulePatterns: [], dailyAttendanceData: [], attendanceLogsData: [] };
  }

  const { start, end } = getDateRange(date);

  // 並列で3つのクエリを実行（パフォーマンス最適化）
  const [schedulePatternsResult, dailyAttendanceResult, attendanceLogsResult] = await Promise.all([
    // 1. 通所パターン取得
    supabase
      .from('s_attendance_schedule')
      .select('child_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, valid_from, valid_to, is_active')
      .eq('is_active', true)
      .lte('valid_from', date)
      .or(`valid_to.is.null,valid_to.gte.${date}`)
      .in('child_id', childIds),

    // 2. 当日出席予定取得
    supabase
      .from('r_daily_attendance')
      .select('child_id, status')
      .eq('facility_id', facilityId)
      .eq('attendance_date', date)
      .in('child_id', childIds),

    // 3. 出席ログ取得
    supabase
      .from('h_attendance')
      .select('child_id, checked_in_at, checked_out_at, check_in_method, check_out_method')
      .eq('facility_id', facilityId)
      .gte('checked_in_at', start)
      .lte('checked_in_at', end)
      .in('child_id', childIds),
  ]);

  const schedulePatterns = schedulePatternsResult.data ?? [];
  const dailyAttendanceData = dailyAttendanceResult.data ?? [];
  const attendanceLogsData = attendanceLogsResult.data ?? [];

  return { dayOfWeekKey, schedulePatterns, dailyAttendanceData, attendanceLogsData };
}

export const isScheduledForDate = (
  schedulePattern: any | undefined,
  dailyRecord: any | undefined,
  dayOfWeekKey: string
) => {
  const scheduledByPattern = schedulePattern ? Boolean(schedulePattern[dayOfWeekKey]) : false;
  let isScheduled = scheduledByPattern;

  if (dailyRecord) {
    if (dailyRecord.status === 'scheduled') {
      isScheduled = true;
    } else if (dailyRecord.status === 'absent' || dailyRecord.status === 'irregular') {
      isScheduled = false;
    }
  }

  return isScheduled;
};
