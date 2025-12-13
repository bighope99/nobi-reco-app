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

    // Check if attendance record already exists
    const { data: existing } = await supabase
      .from('h_attendance')
      .select('id, status')
      .eq('child_id', child_id)
      .eq('attendance_date', today)
      .maybeSingle();

    if (existing) {
      // Update existing record to absent
      const { data: attendance, error: updateError } = await supabase
        .from('h_attendance')
        .update({
          status: 'absent',
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

      return NextResponse.json({
        success: true,
        data: {
          child_id,
          child_name: `${child.family_name} ${child.given_name}`,
          status: attendance.status,
          attendance_date: attendance.attendance_date,
        },
      });
    } else {
      // Create new absent record
      const { data: attendance, error: insertError } = await supabase
        .from('h_attendance')
        .insert({
          child_id,
          facility_id: session.facility_id,
          attendance_date: today,
          status: 'absent',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Attendance insert error:', insertError);
        return NextResponse.json(
          { success: false, error: 'Failed to record absence' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          child_id,
          child_name: `${child.family_name} ${child.given_name}`,
          status: attendance.status,
          attendance_date: attendance.attendance_date,
        },
      });
    }
  } catch (error) {
    console.error('Mark absent error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark as absent' },
      { status: 500 }
    );
  }
}