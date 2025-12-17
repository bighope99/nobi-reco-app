import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getUserSession } from '@/lib/auth/session'

const VALID_STATUSES = ['absent', 'present'] as const

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

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

    const { data: existingRecord, error: fetchError } = await supabase
      .from('h_attendance')
      .select('id, status, checked_in_at, checked_out_at')
      .eq('child_id', child_id)
      .eq('facility_id', facilityId)
      .eq('attendance_date', date)
      .is('deleted_at', null)
      .maybeSingle()

    if (fetchError) {
      console.error('Attendance fetch error:', fetchError)
      return NextResponse.json({ success: false, error: 'Failed to fetch attendance' }, { status: 500 })
    }

    if (status === 'absent') {
      if (existingRecord?.checked_in_at) {
        return NextResponse.json({ success: false, error: 'Already checked in for this date' }, { status: 409 })
      }

      if (existingRecord) {
        const { error: updateError } = await supabase
          .from('h_attendance')
          .update({ status: 'absent', checked_in_at: null, checked_out_at: null })
          .eq('id', existingRecord.id)

        if (updateError) {
          console.error('Attendance update error:', updateError)
          return NextResponse.json({ success: false, error: 'Failed to update attendance' }, { status: 500 })
        }
      } else {
        const { error: insertError } = await supabase
          .from('h_attendance')
          .insert({
            child_id,
            facility_id: facilityId,
            attendance_date: date,
            status: 'absent',
            checked_in_at: null,
            checked_out_at: null,
          })

        if (insertError) {
          console.error('Attendance insert error:', insertError)
          return NextResponse.json({ success: false, error: 'Failed to save attendance' }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, data: { status: 'absent', attendance_date: date } })
    }

    const now = new Date()
    const timePortion = now.toISOString().split('T')[1]
    const checkInTimestamp = new Date(`${date}T${timePortion}`).toISOString()

    if (existingRecord) {
      const { error: updateError } = await supabase
        .from('h_attendance')
        .update({
          status: 'present',
          checked_in_at: existingRecord.checked_in_at || checkInTimestamp,
        })
        .eq('id', existingRecord.id)

      if (updateError) {
        console.error('Attendance update error:', updateError)
        return NextResponse.json({ success: false, error: 'Failed to update attendance' }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase
        .from('h_attendance')
        .insert({
          child_id,
          facility_id: facilityId,
          attendance_date: date,
          status: 'present',
          checked_in_at: checkInTimestamp,
          check_in_method: 'manual',
        })

      if (insertError) {
        console.error('Attendance insert error:', insertError)
        return NextResponse.json({ success: false, error: 'Failed to save attendance' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, data: { status: 'present', attendance_date: date } })
  } catch (error) {
    console.error('Attendance status update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update attendance status' }, { status: 500 })
  }
}
