import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; child_id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: userData } = await supabase
      .from('m_users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (userData.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id: classId, child_id: childId } = await params;

    const { data: classData, error: classError } = await supabase
      .from('m_classes')
      .select('id, facility_id')
      .eq('id', classId)
      .is('deleted_at', null)
      .single();

    if (classError || !classData) {
      return NextResponse.json(
        { success: false, error: 'Class not found' },
        { status: 404 }
      );
    }

    if (userData.role === 'facility_admin') {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const facilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
      if (!facilityIds.includes(classData.facility_id)) {
        return NextResponse.json(
          { success: false, error: 'Class not found' },
          { status: 404 }
        );
      }
    }

    const { data: currentAssignment } = await supabase
      .from('_child_class')
      .select('id')
      .eq('class_id', classId)
      .eq('child_id', childId)
      .eq('is_current', true)
      .single();

    if (!currentAssignment) {
      return NextResponse.json(
        { success: false, error: 'Child not assigned to this class' },
        { status: 404 }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    const { error: updateError } = await supabase
      .from('_child_class')
      .update({ is_current: false, ended_at: today, updated_at: new Date().toISOString() })
      .eq('id', currentAssignment.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: '児童の在籍を解除しました',
    });
  } catch (error) {
    console.error('Error removing child from class:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
