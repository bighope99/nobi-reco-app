/**
 * 長期休暇用日誌テンプレートへのセルマッピング定義
 *
 * テンプレート構造: 1ページ = 55行 x 8列
 */

export const TEMPLATE_CELLS = {
  /** 月日ヘッダー（結合 A1:G1） */
  header: 'A1',
  /** 一日の保育活動と内容（結合 A3:D5） */
  activity: 'A3',
  /** 今日のごはん・おやつ（E3:F5エリア） */
  meal: 'E3',
  /** 通所人数（H3） */
  attendancePresent: 'H3',
  /** お休み人数（H4） */
  attendanceAbsent: 'H4',
  /** 出勤スタッフへの連絡事項（A7） */
  staffNotes: 'A7',
  /** 今日の予定（結合 B10:C10） */
  eventNameCell: 'B10',
  /** スケジュール開始行（11行目） */
  scheduleStartRow: 11,
  /** スケジュール時刻列: A列（1始まり） */
  scheduleTimeCol: 1,
  /** スケジュール内容列: B列（1始まり） */
  scheduleContentCol: 2,
} as const

/** スケジュール開始時刻（分） 8:00 */
const SCHEDULE_START_MINUTES = 8 * 60 // 480

/** スケジュール終了時刻（分）19:00 */
const SCHEDULE_END_MINUTES = 19 * 60 // 1140

/** 1スロットあたりの分数 */
const SLOT_MINUTES = 15

/**
 * "HH:MM" 形式の時刻文字列をスケジュール行番号に変換する
 *
 * 8:00 → 行11、8:15 → 行12、...、19:00 → 行55
 * 範囲外（8:00未満または19:00超）の場合は null を返す
 *
 * @param time "HH:MM" 形式の時刻文字列
 * @returns 行番号（11〜55）または null
 *
 * @example
 * timeToRow("08:00") // 11
 * timeToRow("09:00") // 15
 * timeToRow("19:00") // 55
 * timeToRow("07:00") // null
 * timeToRow("19:01") // null
 */
export function timeToRow(time: string): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  const totalMinutes = hours * 60 + minutes

  if (totalMinutes < SCHEDULE_START_MINUTES || totalMinutes > SCHEDULE_END_MINUTES) {
    return null
  }

  const slotIndex = (totalMinutes - SCHEDULE_START_MINUTES) / SLOT_MINUTES

  // 15分刻みに対応しない端数はnull
  if (!Number.isInteger(slotIndex)) return null

  return TEMPLATE_CELLS.scheduleStartRow + slotIndex
}
