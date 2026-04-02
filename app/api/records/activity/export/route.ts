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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value)
  return !isNaN(d.getTime())
}

/** 日付文字列から日本語の月日曜日表記を生成（例: "7月21日（月）"） */
function formatDateJa(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+09:00`)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const weekday = weekdays[date.getDay()]
  return `${month}月${day}日（${weekday}）`
}

/** シート名用の MM月DD日 表記を生成（例: "07月21日"） */
function formatSheetName(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${month}月${day}日`
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

/** role_assignments JSONからスタッフ名カンマ区切り文字列を生成 */
function formatStaffNames(roleAssignments: unknown): string {
  if (!Array.isArray(roleAssignments)) return ''
  return roleAssignments
    .map((ra: unknown) => {
      if (ra && typeof ra === 'object' && 'user_name' in ra) {
        return (ra as { user_name?: string }).user_name ?? ''
      }
      return ''
    })
    .filter(Boolean)
    .join('、')
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
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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

    // 日付範囲内の全日付一覧
    const dates = generateDateRange(from_date, to_date)

    // 出席集計: 通所（h_attendance）とお休み（r_daily_attendance）を並列取得
    const attendanceResults = await Promise.all(
      dates.map(async (date) => {
        const [checkedInResult, absentResult] = await Promise.all([
          supabase
            .from('h_attendance')
            .select('child_id')
            .eq('facility_id', facility_id)
            .eq('checked_in_date', date)
            .is('deleted_at', null),
          supabase
            .from('r_daily_attendance')
            .select('id', { count: 'exact', head: true })
            .eq('facility_id', facility_id)
            .eq('attendance_date', date)
            .eq('status', 'absent'),
        ])

        if (checkedInResult.error) {
          console.error(`Failed to fetch h_attendance for ${date}:`, checkedInResult.error)
        }
        if (absentResult.error) {
          console.error(`Failed to fetch r_daily_attendance for ${date}:`, absentResult.error)
        }

        // 通所: ユニーク child_id の数
        const uniqueChildIds = new Set(
          (checkedInResult.data ?? []).map((row) => row.child_id)
        )
        const presentCount = uniqueChildIds.size
        const absentCount = absentResult.count ?? 0

        return { date, presentCount, absentCount }
      })
    )

    const attendanceByDate = new Map(
      attendanceResults.map(({ date, presentCount, absentCount }) => [
        date,
        { presentCount, absentCount },
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

    // 出力ワークブック作成
    const outputWb = new ExcelJS.Workbook()

    for (const date of dates) {
      const sheetName = formatSheetName(date)
      const activity = activityByDate.get(date) ?? null
      const attendance = attendanceByDate.get(date) ?? { presentCount: 0, absentCount: 0 }

      // テンプレートを毎回読み込んでシートを複製
      const tmpWb = new ExcelJS.Workbook()
      await tmpWb.xlsx.load(new Uint8Array(templateBuffer).buffer as ArrayBuffer)
      const templateSheet = tmpWb.worksheets[0]

      // 出力ワークブックに新シートを追加してコピー
      const newSheet = outputWb.addWorksheet(sheetName)
      copyTemplateSheet(templateSheet, newSheet)

      // データを書き込む
      // ヘッダー: 月日（例: "7月21日（月）"）
      newSheet.getCell(TEMPLATE_CELLS.header).value = formatDateJa(date)

      if (activity) {
        // 一日の保育活動と内容
        newSheet.getCell(TEMPLATE_CELLS.activity).value = activity.content ?? ''

        // 今日のごはん・おやつ
        const mealText = formatMeal(activity.meal)
        const snackText = activity.snack ?? ''
        const mealSnackText = [mealText, snackText].filter(Boolean).join('\n')
        newSheet.getCell(TEMPLATE_CELLS.meal).value = mealSnackText

        // 出勤スタッフへの連絡事項
        const staffNotesText = activity.handover ?? activity.special_notes ?? ''
        newSheet.getCell(TEMPLATE_CELLS.staffNotes).value = staffNotesText

        // 今日の予定
        newSheet.getCell(TEMPLATE_CELLS.eventName).value = activity.event_name ?? ''

        // スタッフ名一覧
        newSheet.getCell(TEMPLATE_CELLS.staffNames).value = formatStaffNames(activity.role_assignments)

        // daily_schedule → 時間軸マッピング
        if (Array.isArray(activity.daily_schedule)) {
          for (const item of activity.daily_schedule as { time: string; content: string }[]) {
            if (!item?.time) continue
            const row = timeToRow(item.time)
            if (row !== null) {
              newSheet.getCell(row, TEMPLATE_CELLS.scheduleContentCol).value = item.content ?? ''
            }
          }
        }
      }

      // 出席集計（activityの有無に関わらず書き込む）
      newSheet.getCell(TEMPLATE_CELLS.attendancePresent).value = attendance.presentCount
      newSheet.getCell(TEMPLATE_CELLS.attendanceAbsent).value = attendance.absentCount
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
