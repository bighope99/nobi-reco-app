import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session?.facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { child_id } = await request.json();

    if (!child_id) {
      return NextResponse.json(
        { success: false, error: 'child_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if child exists and belongs to facility
    const { data: child, error: childError } = await supabase
      .from('m_children')
      .select('id, family_name, given_name')
      .eq('id', child_id)
      .eq('facility_id', session.facility_id)
      .single();

    if (childError || !child) {
      return NextResponse.json(
        { success: false, error: 'Child not found' },
        { status: 404 }
      );
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Check if already has attendance record today
    const { data: existing } = await supabase
      .from('h_attendance')
      .select('id, status, checked_in_at')
      .eq('child_id', child_id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (existing && existing.status === 'present') {
      return NextResponse.json(
        {
          success: false,
          error: 'Child already checked in today',
          data: {
            child_id,
            child_name: `${child.family_name} ${child.given_name}`,
            checked_in_at: existing.checked_in_at,
          },
        },
        { status: 409 }
      );
    }

    // Create or update attendance record for unexpected attendance
    let attendance;
    if (existing) {
      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from('h_attendance')
        .update({
          status: 'present',
          checked_in_at: now.toISOString(),
          notes: 'Unexpected attendance confirmed by staff',
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('Attendance update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update attendance' },
          { status: 500 }
        );
      }
      attendance = updated;
    } else {
      // Create new record
      const { data: inserted, error: insertError } = await supabase
        .from('h_attendance')
        .insert({
          child_id,
          facility_id: session.facility_id,
          attendance_date: today,
          status: 'present',
          checked_in_at: now.toISOString(),
          notes: 'Unexpected attendance confirmed by staff',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Attendance insert error:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to record unexpected attendance' },
          { status: 500 }
        );
      }
      attendance = inserted;
    }

    return NextResponse.json({
      success: true,
      data: {
        child_id,
        child_name: `${child.family_name} ${child.given_name}`,
        checked_in_at: attendance.checked_in_at,
        attendance_date: attendance.attendance_date,
        status: attendance.status,
        notes: attendance.notes,
      },
    });
  } catch (error) {
    console.error('Unexpected attendance error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to confirm unexpected attendance' },
      { status: 500 }
    );
  }
}