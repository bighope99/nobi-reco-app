/**
 * 遅刻アラート関連のユーティリティと型定義
 * Late arrival alert utilities and type definitions
 * 
 * このモジュールは将来の外部通知機能拡張に対応するため、
 * アラートデータの取得・整形を容易にする構造になっています。
 */

import { LATE_ARRIVAL_THRESHOLD_MINUTES } from '@/lib/constants/attendance';

/**
 * 遅刻アラート情報
 * Late arrival alert data structure
 * 
 * 外部通知システムへの送信や、
 * ダッシュボード表示に必要な情報をすべて含みます。
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
  /** 対象年齢グループ */
  age_group: string;
  /** 学年（1-6） */
  grade: number | null;
  /** 学年ラベル（例: "3年生"） */
  grade_label: string;
  /** 学校ID */
  school_id: string | null;
  /** 学校名 */
  school_name: string | null;
  /** 予定到着時刻（HH:mm形式） */
  scheduled_start_time: string;
  /** 遅刻分数 */
  minutes_late: number;
  /** 保護者電話番号 */
  guardian_phone: string | null;
  /** アラート発生時刻 */
  alert_triggered_at: string;
}

/**
 * 遅刻判定に必要な児童情報
 */
export interface ChildForLateCheck {
  child_id: string;
  name: string;
  kana: string;
  class_name: string;
  age_group: string;
  grade: number | null;
  grade_label: string;
  school_id: string | null;
  school_name: string | null;
  status: 'checked_in' | 'checked_out' | 'absent';
  is_scheduled_today: boolean;
  scheduled_start_time: string | null;
  guardian_phone: string | null;
}

/**
 * 時刻文字列から分数差分を計算
 * Calculate the difference in minutes between two time strings
 * 
 * @param currentTime - 現在時刻（HH:mm形式）
 * @param targetTime - 比較対象時刻（HH:mm形式）
 * @returns 分数差分（正の値 = currentTimeがtargetTimeより後）
 */
export function getMinutesDiff(currentTime: string, targetTime: string): number {
  if (!targetTime || !currentTime) return 0;
  const [h1, m1] = currentTime.split(':').map(Number);
  const [h2, m2] = targetTime.split(':').map(Number);
  return (h1 * 60 + m1) - (h2 * 60 + m2);
}

/**
 * 児童が遅刻アラート対象かどうかを判定
 * Check if a child should trigger a late arrival alert
 * 
 * @param child - 判定対象の児童情報
 * @param currentTime - 現在時刻（HH:mm形式）
 * @param thresholdMinutes - 遅刻とみなす閾値（分）
 * @returns 遅刻アラート対象の場合true
 */
export function isLateArrival(
  child: ChildForLateCheck,
  currentTime: string,
  thresholdMinutes: number = LATE_ARRIVAL_THRESHOLD_MINUTES
): boolean {
  // 未到着（absent）で、本日予定があり、予定到着時刻が設定されている場合のみ判定
  if (child.status !== 'absent') return false;
  if (!child.is_scheduled_today) return false;
  if (!child.scheduled_start_time) return false;

  const minutesLate = getMinutesDiff(currentTime, child.scheduled_start_time);
  return minutesLate >= thresholdMinutes;
}

/**
 * 児童情報から遅刻アラートデータを生成
 * Generate late arrival alert data from child information
 * 
 * @param child - 児童情報
 * @param currentTime - 現在時刻（HH:mm形式）
 * @returns 遅刻アラートデータ
 */
export function createLateArrivalAlert(
  child: ChildForLateCheck,
  currentTime: string
): LateArrivalAlert {
  return {
    child_id: child.child_id,
    name: child.name,
    kana: child.kana,
    class_name: child.class_name,
    age_group: child.age_group,
    grade: child.grade,
    grade_label: child.grade_label,
    school_id: child.school_id,
    school_name: child.school_name,
    scheduled_start_time: child.scheduled_start_time!,
    minutes_late: getMinutesDiff(currentTime, child.scheduled_start_time!),
    guardian_phone: child.guardian_phone,
    alert_triggered_at: new Date().toISOString(),
  };
}

/**
 * 児童リストから遅刻アラート対象を抽出
 * Extract late arrival alerts from a list of children
 * 
 * 外部通知機能で使用する場合は、この関数の戻り値を
 * 通知システムに渡すことで、必要な情報がすべて揃います。
 * 
 * @param children - 児童情報のリスト
 * @param currentTime - 現在時刻（HH:mm形式）
 * @param thresholdMinutes - 遅刻とみなす閾値（分）
 * @returns 遅刻アラートデータのリスト
 */
export function getLateArrivalAlerts(
  children: ChildForLateCheck[],
  currentTime: string,
  thresholdMinutes: number = LATE_ARRIVAL_THRESHOLD_MINUTES
): LateArrivalAlert[] {
  return children
    .filter(child => isLateArrival(child, currentTime, thresholdMinutes))
    .map(child => createLateArrivalAlert(child, currentTime));
}

/**
 * 遅刻アラートのサマリー情報
 * Summary of late arrival alerts for external notifications
 */
export interface LateArrivalSummary {
  /** アラート発生施設ID */
  facility_id: string;
  /** アラート発生日時 */
  generated_at: string;
  /** 遅刻アラートの閾値（分） */
  threshold_minutes: number;
  /** アラート対象児童数 */
  total_count: number;
  /** 学校別の遅刻児童数 */
  by_school: Record<string, number>;
  /** 学年別の遅刻児童数 */
  by_grade: Record<string, number>;
  /** 遅刻アラート詳細リスト */
  alerts: LateArrivalAlert[];
}

/**
 * 遅刻アラートのサマリーを生成
 * Generate late arrival alert summary
 * 
 * 外部通知やレポート生成時に使用します。
 * 
 * @param facilityId - 施設ID
 * @param alerts - 遅刻アラートのリスト
 * @param thresholdMinutes - 使用された閾値（分）
 * @returns サマリー情報
 */
export function createLateArrivalSummary(
  facilityId: string,
  alerts: LateArrivalAlert[],
  thresholdMinutes: number = LATE_ARRIVAL_THRESHOLD_MINUTES
): LateArrivalSummary {
  const bySchool: Record<string, number> = {};
  const byGrade: Record<string, number> = {};

  for (const alert of alerts) {
    // 学校別集計
    const schoolKey = alert.school_name || '未設定';
    bySchool[schoolKey] = (bySchool[schoolKey] || 0) + 1;

    // 学年別集計
    const gradeKey = alert.grade_label || '未設定';
    byGrade[gradeKey] = (byGrade[gradeKey] || 0) + 1;
  }

  return {
    facility_id: facilityId,
    generated_at: new Date().toISOString(),
    threshold_minutes: thresholdMinutes,
    total_count: alerts.length,
    by_school: bySchool,
    by_grade: byGrade,
    alerts,
  };
}
