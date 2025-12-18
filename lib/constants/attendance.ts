/**
 * 出席管理に関するグローバル定数
 * Attendance management global constants
 */

/**
 * 遅刻アラートの閾値（分）
 * 登園予定時刻からこの時間を超えると遅刻アラートが表示される
 * 
 * Late arrival alert threshold in minutes.
 * If a child hasn't arrived after this many minutes past their scheduled start time,
 * a late arrival alert will be triggered.
 * 
 * @default 30
 */
export const LATE_ARRIVAL_THRESHOLD_MINUTES = 30;

/**
 * 未帰所アラートの閾値（分）
 * 降園予定時刻からこの時間を超えると未帰所アラートが表示される
 * 
 * Overdue (not departed) alert threshold in minutes.
 * If a child hasn't left after this many minutes past their scheduled end time,
 * an overdue alert will be triggered.
 * 
 * @default 30
 */
export const OVERDUE_DEPARTURE_THRESHOLD_MINUTES = 30;

/**
 * 遅刻アラートの情報（外部通知用）
 * Late arrival alert data structure for external notifications
 */
export interface LateArrivalAlert {
  /** 児童ID */
  child_id: string;
  /** 児童名 */
  name: string;
  /** 児童名（かな） */
  kana: string;
  /** クラス名 */
  class_name: string;
  /** 年齢グループ */
  age_group: string;
  /** 学年（1-6） */
  grade: number | null;
  /** 学年ラベル（例: "3年生"） */
  grade_label: string;
  /** 学校ID */
  school_id: string | null;
  /** 学校名 */
  school_name: string | null;
  /** 登園予定時刻（HH:mm） */
  scheduled_start_time: string | null;
  /** 遅刻分数 */
  minutes_late: number;
  /** 保護者電話番号 */
  guardian_phone: string;
  /** アラート発生日時 */
  alert_timestamp: string;
}

/**
 * 未帰所アラートの情報（外部通知用）
 * Overdue departure alert data structure for external notifications
 */
export interface OverdueAlert {
  /** 児童ID */
  child_id: string;
  /** 児童名 */
  name: string;
  /** 児童名（かな） */
  kana: string;
  /** クラス名 */
  class_name: string;
  /** 年齢グループ */
  age_group: string;
  /** 学年（1-6） */
  grade: number | null;
  /** 学年ラベル（例: "3年生"） */
  grade_label: string;
  /** 学校ID */
  school_id: string | null;
  /** 学校名 */
  school_name: string | null;
  /** 降園予定時刻（HH:mm） */
  scheduled_end_time: string | null;
  /** 登園実績時刻（HH:mm） */
  actual_in_time: string | null;
  /** 超過分数 */
  minutes_overdue: number;
  /** 保護者電話番号 */
  guardian_phone: string;
  /** アラート発生日時 */
  alert_timestamp: string;
}

/**
 * 予定外登園アラートの情報（外部通知用）
 * Unexpected attendance alert data structure for external notifications
 */
export interface UnexpectedAttendanceAlert {
  /** 児童ID */
  child_id: string;
  /** 児童名 */
  name: string;
  /** 児童名（かな） */
  kana: string;
  /** クラス名 */
  class_name: string;
  /** 年齢グループ */
  age_group: string;
  /** 学年（1-6） */
  grade: number | null;
  /** 学年ラベル（例: "3年生"） */
  grade_label: string;
  /** 登園実績時刻（HH:mm） */
  actual_in_time: string | null;
  /** アラート発生日時 */
  alert_timestamp: string;
}
