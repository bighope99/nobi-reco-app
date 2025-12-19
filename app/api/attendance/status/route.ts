import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth/session'
import { getServerSession } from '@/lib/auth/server-session'

const VALID_STATUSES = ['absent', 'present', 'cancel'] as const

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await getServerSession()
    if ('errorResponse' in sessionResult) {
      return sessionResult.errorResponse
    }

    const { supabase, session } = sessionResult

    const { child_id, date, status } = await request.json()

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

    const userSession = await getUserSession(session.user.id)
    if (!userSession?.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found in session' }, { status: 400 })
    }

    const facilityId = userSession.current_facility_id

    const { data: child, error: childError } = await supabase
      .from('m_children')
      .select('id')
      .eq('id', child_id)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .single()

    if (childError || !child) {
      return NextResponse.json({ success: false, error: 'Child not found for facility' }, { status: 404 })
    }

    const { data: dailyRecord, error: dailyError } = await supabase
      .from('r_daily_attendance')
      .select('*')
      .eq('facility_id', facilityId)
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
          .update({ status, updated_by: session.user.id, updated_at: timestamp })
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
          facility_id: facilityId,
          attendance_date: date,
          status,
          created_by: session.user.id,
          updated_by: session.user.id,
          created_at: timestamp,
          updated_at: timestamp,
        })

      if (insertError) {
        console.error('Daily attendance insert error:', insertError)
        return NextResponse.json({ success: false, error: 'Failed to save daily attendance' }, { status: 500 })
      }
    }

    if (status === 'cancel') {
      const { error: dailyDeleteError } = await supabase
        .from('r_daily_attendance')
        .delete()
        .eq('facility_id', facilityId)
        .eq('child_id', child_id)
        .eq('attendance_date', date)

      if (dailyDeleteError) {
        console.error('Daily attendance delete error:', dailyDeleteError)
        return NextResponse.json({ success: false, error: 'Failed to cancel daily attendance' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: { status: 'canceled', attendance_date: date } })
    }

    if (status === 'absent') {
      const upsertResult = await upsertDailyAttendance('absent')
      if (upsertResult) return upsertResult

      return NextResponse.json({ success: true, data: { status: 'absent', attendance_date: date } })
    }

    const upsertResult = await upsertDailyAttendance('scheduled')
    if (upsertResult) return upsertResult

    return NextResponse.json({ success: true, data: { status: 'present', attendance_date: date } })
  } catch (error) {
    console.error('Attendance status update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update attendance status' }, { status: 500 })
  }
}
