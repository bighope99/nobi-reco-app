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

    const { child_id, content } = await request.json();

    if (!child_id || !content) {
      return NextResponse.json(
        { success: false, error: 'child_id and content are required' },
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

    // Create voice record
    const { data: record, error: insertError } = await supabase
      .from('r_voice')
      .insert({
        child_id,
        facility_id: session.facility_id,
        recorded_by: session.user_id,
        voice_date: now.toISOString().split('T')[0],
        content,
        created_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Voice record insert error:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save voice record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...record,
        child_name: `${child.family_name} ${child.given_name}`,
      },
    });
  } catch (error) {
    console.error('Voice record creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create voice record' },
      { status: 500 }
    );
  }
}