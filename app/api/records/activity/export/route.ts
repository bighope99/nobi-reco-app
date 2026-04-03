import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt'
import { timeToRow, TEMPLATE_CELLS } from '@/lib/templates/daily-journal-mapping'

const TEMPLATE_PATH = path.join(process.cwd(), 'lib/templates/daily-journal-template.xlsx')

/** YYYY-MM-DD 形式のバリデーション */
const isValidDateParam = (value: string): boolean => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return (
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day)
  )
}

/** 日付文字列から日本語の月日曜日表記を生成（例: "7月21日（月）"） */
function formatDateJa(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdays[date.getUTCDay()]
  return `${month}月${day}日（${weekday}）`
}

/** シート名用の MM月DD日 表記を生成（例: "07月21日"） */
function formatSheetName(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${month}月${day}日`
}

/** 年またぎエクスポート用：YYYY/MM月DD日 形式のシート名 */
function formatSheetNameWithYear(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${year}/${month}月${day}日`
}

/** from_date〜to_date の日付一覧を生成 */
function generateDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = []
  const current = new Date(`${fromDate}T00:00:00Z`)
  const end = new Date(`${toDate}T00:00:00Z`)

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setUTCDate(current.getUTCDate() + 1)
  }

  return dates
}

/** meal JSONから表示文字列を生成 */
function formatMeal(meal: unknown): string {
  if (!meal || typeof meal !== 'object') return ''
  const m = meal as { menu?: string; items_to_bring?: string; notes?: string }
  const parts: string[] = []
  if (m.menu) parts.push(m.menu)
  if (m.items_to_bring) parts.push(m.items_to_bring)
  if (m.notes) parts.push(m.notes)
  return parts.join('\n')
}

/** セルに値をセットし、左上詰めアライメントを適用する */
function setCellValue(
  sheet: ExcelJS.Worksheet,
  cellRef: string | [number, number],
  value: ExcelJS.CellValue
): void {
  const cell = typeof cellRef === 'string'
    ? sheet.getCell(cellRef)
    : sheet.getCell(cellRef[0], cellRef[1])
  cell.value = value
  cell.alignment = { ...(cell.alignment ?? {}), vertical: 'top', horizontal: 'left' }
}

/**
 * テンプレートシートのセル・行高さ・列幅・マージ情報を新シートにコピーする
 */
function copyTemplateSheet(
  templateSheet: ExcelJS.Worksheet,
  targetSheet: ExcelJS.Worksheet
): void {
  // 行・セルをコピー
  templateSheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
    const newRow = targetSheet.getRow(rowNum)
    newRow.height = row.height

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const newCell = newRow.getCell(colNum)
      newCell.value = cell.value
      // スタイルをディープコピー
      newCell.style = JSON.parse(JSON.stringify(cell.style))
    })

    newRow.commit()
  })

  // 列幅をコピー
  templateSheet.columns.forEach((col, idx) => {
    const targetCol = targetSheet.getColumn(idx + 1)
    if (col.width) targetCol.width = col.width
  })

  // マージセルをコピー
  const model = (templateSheet as unknown as { model: { merges?: string[] } }).model
  if (model?.merges) {
    for (const merge of model.merges) {
      try {
        targetSheet.mergeCells(merge)
      } catch {
        // 既にマージ済み・範囲エラーは無視
      }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const metadata = await getAuthenticatedUserMetadata()
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: '認証情報が確認できません' },
        { status: 401 }
      )
    }

    if (!metadata.current_facility_id) {
      return NextResponse.json(
        { success: false, error: '施設を選択してください' },
        { status: 400 }
      )
    }

    const facility_id = metadata.current_facility_id
    const { searchParams } = new URL(request.url)
    const from_date = searchParams.get('from_date')
    const to_date = searchParams.get('to_date')

    // パラメータ必須チェック
    if (!from_date || !to_date) {
      return NextResponse.json(
        { success: false, error: 'from_date and to_date are required' },
        { status: 400 }
      )
    }

    // 形式バリデーション
    if (!isValidDateParam(from_date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid from_date format. Use YYYY-MM-DD.' },
        { status: 400 }
      )
    }
    if (!isValidDateParam(to_date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid to_date format. Use YYYY-MM-DD.' },
        { status: 400 }
      )
    }
    if (from_date > to_date) {
      return NextResponse.json(
        { success: false, error: 'from_date must not be after to_date.' },
        { status: 400 }
      )
    }

    const MAX_EXPORT_DAYS = 31
    const dates = generateDateRange(from_date, to_date)
    if (dates.length > MAX_EXPORT_DAYS) {
      return NextResponse.json(
        { success: false, error: `エクスポート期間は${MAX_EXPORT_DAYS}日以内で指定してください` },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // r_activity を日付範囲でフェッチ
    const { data: activities, error: activitiesError } = await supabase
      .from('r_activity')
      .select(`
        id,
        activity_date,
        content,
        meal,
        snack,
        handover,
        special_notes,
        event_name,
        role_assignments,
        daily_schedule
      `)
      .eq('facility_id', facility_id)
      .gte('activity_date', from_date)
      .lte('activity_date', to_date)
      .is('deleted_at', null)
      .order('activity_date', { ascending: true })

    if (activitiesError) {
      console.error('Failed to fetch activities:', activitiesError)
      return NextResponse.json(
        { success: false, error: 'データの取得に失敗しました' },
        { status: 500 }
      )
    }

    // 日付→activityのマップを構築
    const activityByDate = new Map<string, (typeof activities)[number]>()
    for (const activity of activities ?? []) {
      activityByDate.set(activity.activity_date, activity)
    }

    // 出席集計: バッチクエリで全日付を一括取得
    const [checkedInResult, absentResult] = await Promise.all([
      supabase
        .from('h_attendance')
        .select('child_id, checked_in_date')
        .eq('facility_id', facility_id)
        .gte('checked_in_date', from_date)
        .lte('checked_in_date', to_date)
        .is('deleted_at', null),
      supabase
        .from('r_daily_attendance')
        .select('attendance_date')
        .eq('facility_id', facility_id)
        .gte('attendance_date', from_date)
        .lte('attendance_date', to_date)
        .eq('status', 'absent'),
    ])

    if (checkedInResult.error) {
      console.error('Failed to fetch h_attendance:', checkedInResult.error)
      return NextResponse.json(
        { success: false, error: 'データの取得に失敗しました' },
        { status: 500 }
      )
    }
    if (absentResult.error) {
      console.error('Failed to fetch r_daily_attendance:', absentResult.error)
      return NextResponse.json(
        { success: false, error: 'データの取得に失敗しました' },
        { status: 500 }
      )
    }

    // 日付ごとの出席マップを構築
    const presentByDate = new Map<string, Set<string>>()
    for (const row of checkedInResult.data ?? []) {
      if (!presentByDate.has(row.checked_in_date)) presentByDate.set(row.checked_in_date, new Set())
      presentByDate.get(row.checked_in_date)!.add(row.child_id)
    }

    const absentCountByDate = new Map<string, number>()
    for (const row of absentResult.data ?? []) {
      absentCountByDate.set(row.attendance_date, (absentCountByDate.get(row.attendance_date) ?? 0) + 1)
    }

    const attendanceByDate = new Map(
      dates.map(date => [
        date,
        {
          presentCount: presentByDate.get(date)?.size ?? 0,
          absentCount: absentCountByDate.get(date) ?? 0,
        },
      ])
    )

    // テンプレートファイルを読み込み
    if (!fs.existsSync(TEMPLATE_PATH)) {
      console.error('Template file not found:', TEMPLATE_PATH)
      return NextResponse.json(
        { success: false, error: 'テンプレートファイルが見つかりません' },
        { status: 500 }
      )
    }

    const templateBuffer = fs.readFileSync(TEMPLATE_PATH)

    const tmpWb = new ExcelJS.Workbook()
    await tmpWb.xlsx.load(new Uint8Array(templateBuffer).buffer as ArrayBuffer)
    const templateSheet = tmpWb.worksheets[0]

    // 出力ワークブック作成
    const outputWb = new ExcelJS.Workbook()

    const spansMultipleYears = from_date.split('-')[0] !== to_date.split('-')[0]

    for (const date of dates) {
      const activity = activityByDate.get(date) ?? null
      const attendance = attendanceByDate.get(date) ?? { presentCount: 0, absentCount: 0 }

      // 記録なし＋通所ゼロの日はスキップ
      if (!activity && attendance.presentCount === 0) {
        continue
      }

      const sheetName = spansMultipleYears ? formatSheetNameWithYear(date) : formatSheetName(date)

      // 出力ワークブックに新シートを追加してコピー
      const newSheet = outputWb.addWorksheet(sheetName)
      copyTemplateSheet(templateSheet, newSheet)

      // データを書き込む
      // ヘッダー: 月日（例: "7月21日（月）"）
      setCellValue(newSheet, TEMPLATE_CELLS.header, formatDateJa(date))

      if (activity) {
        // 一日の保育活動と内容
        setCellValue(newSheet, TEMPLATE_CELLS.activity, activity.content ?? '')

        // 今日のごはん・おやつ
        const mealText = formatMeal(activity.meal)
        const snackText = activity.snack ?? ''
        const mealSnackText = [mealText, snackText].filter(Boolean).join('\n')
        setCellValue(newSheet, TEMPLATE_CELLS.meal, mealSnackText)

        // 出勤スタッフへの連絡事項
        setCellValue(newSheet, TEMPLATE_CELLS.staffNotes, activity.handover ?? activity.special_notes ?? '')

        // 行事名（10行目）
        setCellValue(newSheet, TEMPLATE_CELLS.eventNameCell, activity.event_name?.trim() || 'なし')

        // daily_schedule → 時間軸マッピング
        if (Array.isArray(activity.daily_schedule)) {
          const scheduleEndRow =
            TEMPLATE_CELLS.scheduleStartRow + (19 * 60 - 8 * 60) / 15 // 11 + 44 = 55
          const writtenRows: number[] = []

          for (const item of activity.daily_schedule as { time: string; content: string }[]) {
            if (!item?.time) continue
            const match = item.time.match(/^(\d{2}):(\d{2})$/)
            if (!match) continue

            const totalMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
            const resolvedRow =
              totalMinutes < 8 * 60
                ? TEMPLATE_CELLS.scheduleStartRow
                : totalMinutes > 19 * 60
                  ? scheduleEndRow
                  : timeToRow(item.time)

            if (resolvedRow === null) continue

            setCellValue(newSheet, [resolvedRow, TEMPLATE_CELLS.scheduleContentCol], item.content ?? '')
            writtenRows.push(resolvedRow)
          }

          // 最初の書き込み行より前の行をクリア（書き込んだ行をトラッキング済み）
          if (writtenRows.length > 0) {
            const firstRow = Math.min(...writtenRows)
            for (let r = TEMPLATE_CELLS.scheduleStartRow; r < firstRow; r++) {
              newSheet.getCell(r, TEMPLATE_CELLS.scheduleTimeCol).value = ''
              newSheet.getCell(r, TEMPLATE_CELLS.scheduleContentCol).value = ''
            }
          }
        }
      }

      // 出席集計（activityの有無に関わらず書き込む）
      setCellValue(newSheet, TEMPLATE_CELLS.attendancePresent, attendance.presentCount)
      setCellValue(newSheet, TEMPLATE_CELLS.attendanceAbsent, attendance.absentCount)
    }

    // 全ワークブックが空の場合
    if (outputWb.worksheets.length === 0) {
      return NextResponse.json(
        { success: false, error: '該当するデータがありません' },
        { status: 404 }
      )
    }

    // Excelバイナリを返却
    const buffer = await outputWb.xlsx.writeBuffer()
    const filename = encodeURIComponent(`保育日誌_${from_date}_${to_date}.xlsx`)

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    })
  } catch (error) {
    console.error('Unexpected error in activity export:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
