import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAuthenticatedUserMetadata, hasPermission } from '@/lib/auth/jwt'

/**
 * チェックイン・チェックアウト時刻の修正API
 * facility_admin 以上の権限が必要
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const metadata = await getAuthenticatedUserMetadata()
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 時刻修正は facility_admin 以上のみ許可
    if (!hasPermission(metadata, ['site_admin', 'company_admin', 'facility_admin'])) {
      return NextResponse.json({ success: false, error: 'Forbidden: insufficient permissions' }, { status: 403 })
    }

    const { current_facility_id: facility_id, user_id } = metadata
    if (!facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 })
    }

    const { child_id, date, field, time } = await request.json()

    if (!child_id || !date || !field || !time) {
      return NextResponse.json(
        { success: false, error: 'child_id, date, field and time are required' },
        { status: 400 }
      )
    }

    if (field !== 'checked_in_at' && field !== 'checked_out_at') {
      return NextResponse.json({ success: false, error: 'field must be checked_in_at or checked_out_at' }, { status: 400 })
    }

    // time は "HH:MM" 形式を期待
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ success: false, error: 'time must be HH:MM format' }, { status: 400 })
    }

    // 児童が施設に所属しているか確認
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

    // 対象日の出席レコードを取得
    const targetDate = date as string
    const startOfDayUTC = new Date(`${targetDate}T00:00:00+09:00`).toISOString()
    const endOfDayUTC = new Date(`${targetDate}T23:59:59.999+09:00`).toISOString()

    const { data: attendance, error: attendanceError } = await supabase
      .from('h_attendance')
      .select('id, checked_in_at, checked_out_at')
      .eq('child_id', child_id)
      .eq('facility_id', facility_id)
      .gte('checked_in_at', startOfDayUTC)
      .lte('checked_in_at', endOfDayUTC)
      .is('deleted_at', null)
      .order('checked_in_at', { ascending: true })
      .maybeSingle()

    if (attendanceError) {
      console.error('Attendance fetch error:', attendanceError)
      return NextResponse.json({ success: false, error: 'Failed to fetch attendance record' }, { status: 500 })
    }

    // 修正する時刻のISO文字列を構築（JSTベース）
    const newTimestamp = new Date(`${targetDate}T${time}:00+09:00`).toISOString()

    if (!attendance) {
      if (field === 'checked_in_at') {
        const { error: insertError } = await supabase
          .from('h_attendance')
          .insert({
            child_id,
            facility_id,
            checked_in_at: newTimestamp,
            check_in_method: 'manual',
            checked_in_by: user_id,
            created_at: new Date().toISOString(),
          })

        if (insertError) {
          console.error('Attendance time insert error:', insertError)
          return NextResponse.json({ success: false, error: 'Failed to create attendance time' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          data: {
            child_id,
            date: targetDate,
            field,
            new_time: newTimestamp,
          },
        })
      }

      return NextResponse.json({ success: false, error: 'No attendance record found for this date' }, { status: 404 })
    }

    // チェックアウト修正時のバリデーション: チェックイン後である必要がある
    if (field === 'checked_out_at' && attendance.checked_in_at) {
      if (new Date(newTimestamp) <= new Date(attendance.checked_in_at)) {
        return NextResponse.json(
          { success: false, error: 'チェックアウト時刻はチェックイン時刻より後である必要があります' },
          { status: 400 }
        )
      }
    }

    // チェックイン修正時のバリデーション: チェックアウト前である必要がある
    if (field === 'checked_in_at' && attendance.checked_out_at) {
      if (new Date(newTimestamp) >= new Date(attendance.checked_out_at)) {
        return NextResponse.json(
          { success: false, error: 'チェックイン時刻はチェックアウト時刻より前である必要があります' },
          { status: 400 }
        )
      }
    }

    const updateData: Record<string, string> = {
      [field]: newTimestamp,
      // 更新者を記録
      ...(field === 'checked_in_at' ? { checked_in_by: user_id } : { checked_out_by: user_id }),
    }

    const { error: updateError } = await supabase
      .from('h_attendance')
      .update(updateData)
      .eq('id', attendance.id)

    if (updateError) {
      console.error('Attendance time update error:', updateError)
      return NextResponse.json({ success: false, error: 'Failed to update attendance time' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        child_id,
        date: targetDate,
        field,
        new_time: newTimestamp,
      },
    })
  } catch (error) {
    console.error('Attendance time PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
