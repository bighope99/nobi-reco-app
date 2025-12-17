import { SupabaseClient } from '@supabase/supabase-js';

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
  const start = `${date}T00:00:00`;
  const end = `${date}T23:59:59.999`;
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + 1);

  return {
    start,
    end,
    nextDateString: nextDate.toISOString().split('T')[0],
  };
};

export const getDayOfWeekKey = (date: string) => weekdayKeys[new Date(`${date}T00:00:00`).getDay()];

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

  const { data: schedulePatternsRaw } = await supabase
    .from('s_attendance_schedule')
    .select('child_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, valid_from, valid_to, is_active')
    .eq('is_active', true)
    .lte('valid_from', date)
    .or(`valid_to.is.null,valid_to.gte.${date}`)
    .in('child_id', childIds);

  const { data: dailyAttendanceDataRaw } = await supabase
    .from('r_daily_attendance')
    .select('child_id, status')
    .eq('facility_id', facilityId)
    .eq('attendance_date', date)
    .in('child_id', childIds);

  const { start, end } = getDateRange(date);

  const { data: attendanceLogsDataRaw } = await supabase
    .from('h_attendance')
    .select('child_id, checked_in_at, checked_out_at, check_in_method, check_out_method')
    .eq('facility_id', facilityId)
    .gte('checked_in_at', start)
    .lte('checked_in_at', end)
    .in('child_id', childIds);

  const schedulePatterns = schedulePatternsRaw ?? [];
  const dailyAttendanceData = dailyAttendanceDataRaw ?? [];
  const attendanceLogsData = attendanceLogsDataRaw ?? [];

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
