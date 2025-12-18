export type AttendanceLogsIndex = Record<string, {
  activeLog: any | null;
  latestClosedLog: any | null;
}>;

export type ObservationSummary = Record<string, {
  lastRecordDate: string | null;
  weeklyCount: number;
}>;

export type AttendanceListItem = {
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

export const buildAttendanceLogsIndex = (attendanceLogs: any[]): AttendanceLogsIndex => {
  return attendanceLogs.reduce((acc: AttendanceLogsIndex, log: any) => {
    const childId = log.child_id;
    const currentEntry = acc[childId] || { activeLog: null, latestClosedLog: null };
    const checkedInAt = new Date(log.checked_in_at).getTime();

    if (!log.checked_out_at) {
      const currentActiveTime = currentEntry.activeLog ? new Date(currentEntry.activeLog.checked_in_at).getTime() : -Infinity;
      if (checkedInAt > currentActiveTime) {
        currentEntry.activeLog = log;
      }
    } else {
      const currentClosedTime = currentEntry.latestClosedLog
        ? new Date(currentEntry.latestClosedLog.checked_in_at).getTime()
        : -Infinity;
      if (checkedInAt > currentClosedTime) {
        currentEntry.latestClosedLog = log;
      }
    }

    acc[childId] = currentEntry;
    return acc;
  }, {});
};

export const buildObservationSummary = (observations: any[]): ObservationSummary => {
  return observations.reduce((acc: ObservationSummary, obs: any) => {
    const childId = obs.child_id;
    const current = acc[childId] || { lastRecordDate: null, weeklyCount: 0 };
    current.weeklyCount += 1;
    if (!current.lastRecordDate || obs.observation_date > current.lastRecordDate) {
      current.lastRecordDate = obs.observation_date;
    }
    acc[childId] = current;
    return acc;
  }, {});
};

export const determineStatus = (
  activeLog: any | null,
  latestClosedLog: any | null,
  dailyRecordStatus?: string
): AttendanceListItem['status'] => {
  if (activeLog) {
    return 'checked_in';
  }
  if (latestClosedLog) {
    return 'checked_out';
  }
  if (!activeLog && !latestClosedLog && dailyRecordStatus === 'absent') {
    return 'absent';
  }
  return 'absent';
};

export const calculateKpis = (attendanceList: AttendanceListItem[]) => {
  return attendanceList.reduce(
    (acc, child) => {
      if (child.is_scheduled_today) {
        acc.scheduledToday += 1;
      }
      if (child.status === 'checked_in') {
        acc.presentNow += 1;
      } else if (child.status === 'checked_out') {
        acc.checkedOut += 1;
      } else if (child.is_scheduled_today && child.status === 'absent') {
        acc.notArrived += 1;
      }
      return acc;
    },
    { scheduledToday: 0, presentNow: 0, notArrived: 0, checkedOut: 0 }
  );
};
