/**
 * Dashboard API共通ユーティリティ
 */

import type { SchoolSchedule, DayOfWeekKey } from './types';

/**
 * 学校の登校予定時刻を取得
 *
 * @param schoolId - 学校ID
 * @param grade - 学年
 * @param schoolSchedules - 学校スケジュールのマップ
 * @param dayOfWeekKey - 曜日キー
 * @returns 登校予定時刻、または null
 */
export function getSchoolStartTime(
  schoolId: string | null,
  grade: number | null,
  schoolSchedules: Record<string, SchoolSchedule[]>,
  dayOfWeekKey: DayOfWeekKey
): string | null {
  if (!schoolId || grade === null || grade === undefined) return null;

  const schedules = schoolSchedules[schoolId] || [];
  const gradeKey = String(grade);
  const matchedSchedule = schedules.find((schedule) =>
    (schedule.grades || []).includes(gradeKey)
  );

  if (!matchedSchedule) return null;

  const weekdayKey = `${dayOfWeekKey}_time` as keyof SchoolSchedule;
  return (matchedSchedule[weekdayKey] as string | null) || null;
}

/**
 * 時刻を HH:MM 形式にフォーマット
 *
 * @param time - 時刻文字列
 * @returns フォーマットされた時刻、または null
 */
export function formatTimeToMinutes(time: string | null): string | null {
  if (!time) return null;
  const [hours, minutes] = time.split(':');
  return `${hours}:${minutes}`;
}

/**
 * 学校スケジュールをグループ化
 *
 * @param scheduleData - 学校スケジュールの配列
 * @returns 学校IDをキーとしたスケジュールのマップ
 */
export function groupSchoolSchedules(
  scheduleData: SchoolSchedule[]
): Record<string, SchoolSchedule[]> {
  const schoolSchedules: Record<string, SchoolSchedule[]> = {};

  for (const schedule of scheduleData) {
    if (!schoolSchedules[schedule.school_id]) {
      schoolSchedules[schedule.school_id] = [];
    }
    schoolSchedules[schedule.school_id].push(schedule);
  }

  return schoolSchedules;
}
