import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt'
import { createClient } from '@/utils/supabase/server'
import { getCurrentDateJST } from '@/lib/utils/timezone'

export async function POST(req: NextRequest) {
  const metadata = await getAuthenticatedUserMetadata()
  if (!metadata) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { current_facility_id: facilityId, user_id: userId } = metadata
  if (!facilityId) {
    return NextResponse.json({ error: 'No facility' }, { status: 404 })
  }

  const { child_id } = await req.json()
  if (!child_id) {
    return NextResponse.json({ error: 'child_id required' }, { status: 400 })
  }

  const supabase = await createClient()

  // 施設所属チェック
  const { data: child, error: childError } = await supabase
    .from('m_children')
    .select('id')
    .eq('id', child_id)
    .eq('facility_id', facilityId)
    .eq('enrollment_status', 'enrolled')
    .is('deleted_at', null)
    .maybeSingle()

  if (childError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!child) {
    return NextResponse.json({ error: 'Child not found' }, { status: 404 })
  }

  const todayJST = getCurrentDateJST()
  const startOfDayUTC = new Date(`${todayJST}T00:00:00+09:00`).toISOString()
  const endOfDayUTC = new Date(`${todayJST}T23:59:59.999+09:00`).toISOString()
  const now = new Date().toISOString()

  // 当日レコードを検索
  const { data: existing, error: existingError } = await supabase
    .from('h_attendance')
    .select('id, checked_in_at, checked_out_at')
    .eq('child_id', child_id)
    .eq('facility_id', facilityId)
    .gte('checked_in_at', startOfDayUTC)
    .lte('checked_in_at', endOfDayUTC)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!existing) {
    // 1回目: チェックイン
    const { data: insertData, error } = await supabase
      .from('h_attendance')
      .insert({
        child_id,
        facility_id: facilityId,
        checked_in_at: now,
        check_in_method: 'self',
        checked_in_by: userId,
      })
      .select('id')
      .single()
    if (error) {
      // Handle unique constraint violation (race condition)
      if (error.code === '23505') {
        const { data: existing2 } = await supabase
          .from('h_attendance')
          .select('id, checked_in_at')
          .eq('child_id', child_id)
          .eq('facility_id', facilityId)
          .gte('checked_in_at', startOfDayUTC)
          .lte('checked_in_at', endOfDayUTC)
          .maybeSingle()
        if (existing2) {
          return NextResponse.json({ action: 'check_in', time: existing2.checked_in_at, attendance_id: existing2.id })
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ action: 'check_in', time: now, attendance_id: insertData.id })
  } else {
    // Fix 4: 既にチェックアウト済みの場合は 409
    if (existing.checked_out_at) {
      return NextResponse.json({ error: 'Already checked out' }, { status: 409 })
    }
    // 2回目以降: チェックアウト（上書き含む）
    const { error } = await supabase
      .from('h_attendance')
      .update({
        checked_out_at: now,
        check_out_method: 'self',
        checked_out_by: userId,
      })
      .eq('id', existing.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ action: 'check_out', time: now, attendance_id: existing.id })
  }
}

export async function DELETE(req: NextRequest) {
  const metadata = await getAuthenticatedUserMetadata()
  if (!metadata) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { current_facility_id: facilityId } = metadata
  if (!facilityId) {
    return NextResponse.json({ error: 'No facility' }, { status: 404 })
  }

  const { attendance_id, action } = await req.json()
  if (!attendance_id || !action) {
    return NextResponse.json({ error: 'attendance_id and action required' }, { status: 400 })
  }

  const supabase = await createClient()

  // 施設所属チェック
  const { data: record, error: recordError } = await supabase
    .from('h_attendance')
    .select('id, checked_out_at')
    .eq('id', attendance_id)
    .eq('facility_id', facilityId)
    .maybeSingle()

  if (recordError) {
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  if (!record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  }

  // Fix 5: actionとDBの実際の状態を照合してバリデーション
  if (action === 'check_in' && record.checked_out_at !== null) {
    return NextResponse.json({ error: 'Record has checkout, cannot undo check-in' }, { status: 400 })
  }
  if (action === 'check_out' && record.checked_out_at === null) {
    return NextResponse.json({ error: 'No checkout to undo' }, { status: 400 })
  }

  if (record.checked_out_at === null) {
    // チェックインのundo → レコードを削除
    const { error } = await supabase
      .from('h_attendance')
      .delete()
      .eq('id', attendance_id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    // チェックアウトのundo → checked_out_at をクリア
    const { error } = await supabase
      .from('h_attendance')
      .update({
        checked_out_at: null,
        check_out_method: null,
        checked_out_by: null,
      })
      .eq('id', attendance_id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
