import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt'

/** 今日の日付をJSTで YYYY-MM-DD 形式で返す */
const getTodayJST = (): string => {
  const now = new Date()
  const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const y = jstDate.getUTCFullYear()
  const m = String(jstDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(jstDate.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 日付文字列が今日より過去かどうか判定 */
const isPastDate = (date: string): boolean => date < getTodayJST()

const VALID_STATUSES = ['absent', 'present', 'cancel', 'cancel_check_in', 'cancel_check_out'] as const
type ValidStatus = typeof VALID_STATUSES[number]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata()
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { current_facility_id: facility_id, user_id } = metadata
    if (!facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 })
    }

    const { child_id, date, status } = await request.json() as { child_id: string; date: string; status: ValidStatus }

    if (!child_id || !date || !status) {
      return NextResponse.json({ success: false, error: 'child_id, date and status are required' }, { status: 400 })
    }

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const attendanceDate = new Date(`${date}T00:00:00`)
    if (Number.isNaN(attendanceDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 })
    }

    const { data: child, error: childError } = await supabase
      .from('m_children')
      .select('id')
      .eq('id', child_id)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .single()

    if (childError || !child) {
      return NextResponse.json({ success: false, error: 'Child not found for facility' }, { status: 404 })
    }

    if (status === 'cancel_check_in' || status === 'cancel_check_out') {
      if (!hasPermission(metadata, ['site_admin', 'company_admin', 'facility_admin'])) {
        return NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions' }, { status: 403 })
      }
    }

    const { data: dailyRecord, error: dailyError } = await supabase
      .from('r_daily_attendance')
      .select('*')
      .eq('facility_id', facility_id)
      .eq('child_id', child_id)
      .eq('attendance_date', date)
      .maybeSingle()

    if (dailyError) {
      console.error('Daily attendance fetch error:', dailyError)
      return NextResponse.json({ success: false, error: 'Failed to fetch daily attendance' }, { status: 500 })
    }

    const timestamp = new Date().toISOString()

    const upsertDailyAttendance = async (status: 'scheduled' | 'absent' | 'irregular') => {
      if (dailyRecord) {
        const { error: updateError } = await supabase
          .from('r_daily_attendance')
          .update({ status, updated_by: user_id, updated_at: timestamp })
          .eq('id', dailyRecord.id)

        if (updateError) {
          console.error('Daily attendance update error:', updateError)
          return NextResponse.json({ success: false, error: 'Failed to update daily attendance' }, { status: 500 })
        }

        return
      }

      const { error: insertError } = await supabase
        .from('r_daily_attendance')
        .insert({
          child_id,
          facility_id: facility_id,
          attendance_date: date,
          status,
          created_by: user_id,
          updated_by: user_id,
          created_at: timestamp,
          updated_at: timestamp,
        })

      if (insertError) {
        console.error('Daily attendance insert error:', insertError)
        return NextResponse.json({ success: false, error: 'Failed to save daily attendance' }, { status: 500 })
      }
    }

    const dayStart = `${date}T00:00:00+09:00`
    const nextDateObj = new Date(new Date(`${date}T00:00:00+09:00`).getTime() + 24 * 60 * 60 * 1000)
    const nextY = nextDateObj.getUTCFullYear()
    const nextM = String(nextDateObj.getUTCMonth() + 1).padStart(2, '0')
    const nextD = String(nextDateObj.getUTCDate()).padStart(2, '0')
    const dayEnd = `${nextY}-${nextM}-${nextD}T00:00:00+09:00`

    if (status === 'cancel') {
      const { error: dailyDeleteError } = await supabase
        .from('r_daily_attendance')
        .delete()
        .eq('facility_id', facility_id)
        .eq('child_id', child_id)
        .eq('attendance_date', date)

      if (dailyDeleteError) {
        console.error('Daily attendance delete error:', dailyDeleteError)
        return NextResponse.json({ success: false, error: 'Failed to cancel daily attendance' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: { status: 'canceled', attendance_date: date } })
    }

    if (status === 'cancel_check_in') {
      const { data: hRecord, error: hFetchError } = await supabase
        .from('h_attendance')
        .select('id')
        .eq('child_id', child_id)
        .eq('facility_id', facility_id)
        .gte('checked_in_at', dayStart)
        .lt('checked_in_at', dayEnd)
        .is('deleted_at', null)
        .maybeSingle()

      if (hFetchError) {
        console.error('h_attendance fetch error:', hFetchError)
        return NextResponse.json({ success: false, error: 'Failed to fetch attendance record' }, { status: 500 })
      }

      if (!hRecord) {
        return NextResponse.json({ success: false, error: 'Attendance record not found' }, { status: 404 })
      }

      const { error: hSoftDeleteError } = await supabase
        .from('h_attendance')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', hRecord.id)

      if (hSoftDeleteError) {
        console.error('h_attendance soft delete error:', hSoftDeleteError)
        return NextResponse.json({ success: false, error: 'Failed to cancel check-in' }, { status: 500 })
      }

      if (dailyRecord) {
        const { error: dailyResetError } = await supabase
          .from('r_daily_attendance')
          .update({ status: 'absent', updated_by: user_id, updated_at: timestamp })
          .eq('id', dailyRecord.id)

        if (dailyResetError) {
          console.error('Daily attendance reset error:', dailyResetError)
          return NextResponse.json({ success: false, error: 'Failed to reset daily attendance' }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, data: { status: 'cancelled', attendance_date: date } })
    }

    if (status === 'cancel_check_out') {
      const { data: hRecord, error: hFetchError } = await supabase
        .from('h_attendance')
        .select('id')
        .eq('child_id', child_id)
        .eq('facility_id', facility_id)
        .gte('checked_in_at', dayStart)
        .lt('checked_in_at', dayEnd)
        .is('deleted_at', null)
        .maybeSingle()

      if (hFetchError) {
        console.error('h_attendance fetch error:', hFetchError)
        return NextResponse.json({ success: false, error: 'Failed to fetch attendance record' }, { status: 500 })
      }

      if (!hRecord) {
        return NextResponse.json({ success: false, error: 'Attendance record not found' }, { status: 404 })
      }

      const { error: hCancelCheckOutError } = await supabase
        .from('h_attendance')
        .update({ checked_out_at: null, check_out_method: null, checked_out_by: null })
        .eq('id', hRecord.id)

      if (hCancelCheckOutError) {
        console.error('h_attendance cancel check-out error:', hCancelCheckOutError)
        return NextResponse.json({ success: false, error: 'Failed to cancel check-out' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: { status: 'checkout_cancelled', attendance_date: date } })
    }

    if (status === 'absent') {
      const upsertResult = await upsertDailyAttendance('absent')
      if (upsertResult) return upsertResult

      // 過去日付の場合: h_attendance のチェックイン記録を削除
      if (isPastDate(date)) {
        const { error: hDeleteError } = await supabase
          .from('h_attendance')
          .delete()
          .eq('child_id', child_id)
          .eq('facility_id', facility_id)
          .gte('checked_in_at', dayStart)
          .lt('checked_in_at', dayEnd)

        if (hDeleteError) {
          console.error('h_attendance delete error:', hDeleteError)
          return NextResponse.json({ success: false, error: 'Failed to delete attendance record' }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, data: { status: 'absent', attendance_date: date } })
    }

    const upsertResult = await upsertDailyAttendance('scheduled')
    if (upsertResult) return upsertResult

    // 過去日付の場合: h_attendance に手動チェックイン記録をupsert
    // checked_in_date (JST) のユニーク制約により重複を防止
    if (isPastDate(date)) {
      const checkedInAt = `${date}T09:00:00+09:00`

      const { error: hUpsertError } = await supabase
        .from('h_attendance')
        .upsert({
          child_id,
          facility_id,
          checked_in_at: checkedInAt,
          check_in_method: 'manual',
          checked_in_by: user_id,
          created_at: timestamp,
        }, { onConflict: 'child_id,facility_id,checked_in_date' })

      if (hUpsertError) {
        console.error('h_attendance upsert error:', hUpsertError)
        return NextResponse.json({ success: false, error: 'Failed to create attendance record' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, data: { status: 'present', attendance_date: date } })
  } catch (error) {
    console.error('Attendance status update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update attendance status' }, { status: 500 })
  }
}
