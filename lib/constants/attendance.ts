/**
 * 出席・遅刻関連の定数
 * Attendance and late arrival related constants
 */

/**
 * 遅刻アラートの閾値（分）
 * Late arrival alert threshold in minutes
 * 
 * 学校の登校予定時刻からこの時間が経過しても到着しない場合、
 * アラートが表示されます。
 * 
 * @example
 * // 15:00 登校予定 + 30分 = 15:30 以降に未到着でアラート
 */
export const LATE_ARRIVAL_THRESHOLD_MINUTES = 30;

/**
 * 未帰所アラートの閾値（分）
 * Overdue (not left) alert threshold in minutes
 */
export const OVERDUE_DEPARTURE_THRESHOLD_MINUTES = 30;

/**
 * アラートの優先度
 * Alert priority levels (lower number = higher priority)
 */
export const ALERT_PRIORITY = {
  /** 未帰所（超過） - 最高優先度 */
  OVERDUE: 1,
  /** 未登園（遅刻） */
  LATE_ARRIVAL: 2,
  /** 予定外登園 */
  UNEXPECTED: 3,
} as const;

export type AlertPriorityType = typeof ALERT_PRIORITY[keyof typeof ALERT_PRIORITY];
