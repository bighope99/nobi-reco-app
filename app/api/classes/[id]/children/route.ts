import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: classId } = await params;

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

    const body = await request.json();
    const { child_ids } = body;

    if (!Array.isArray(child_ids) || child_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'child_ids is required' },
        { status: 400 }
      );
    }

    const { data: children, error: childrenError } = await supabase
      .from('m_children')
      .select(
        'id, facility_id, family_name, given_name, family_name_kana, given_name_kana, birth_date, enrollment_status'
      )
      .in('id', child_ids)
      .is('deleted_at', null);

    if (childrenError) {
      throw childrenError;
    }

    if (!children || children.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Children not found' },
        { status: 404 }
      );
    }

    const invalidFacilityChild = children.find(
      (child) => child.facility_id !== classData.facility_id
    );

    if (invalidFacilityChild) {
      return NextResponse.json(
        { success: false, error: 'Children must belong to the same facility' },
        { status: 400 }
      );
    }

    const { data: existingAssignments } = await supabase
      .from('_child_class')
      .select('child_id')
      .eq('class_id', classId)
      .eq('is_current', true)
      .in('child_id', child_ids);

    const existingChildIds = new Set(
      (existingAssignments || []).map((assignment) => assignment.child_id)
    );

    const newChildIds = child_ids.filter((id: string) => !existingChildIds.has(id));

    if (newChildIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { added: [] },
        message: 'すでに在籍している児童のみでした',
      });
    }

    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];

    const { data: inserts, error: insertError } = await supabase
      .from('_child_class')
      .insert(
        newChildIds.map((childId: string) => ({
          child_id: childId,
          class_id: classId,
          school_year: currentYear,
          started_at: today,
          is_current: true,
        }))
      )
      .select();

    if (insertError) {
      throw insertError;
    }

    const addedChildren = children
      .filter((child) => newChildIds.includes(child.id))
      .map((child) => ({
        id: child.id,
        name: `${child.family_name} ${child.given_name}`,
        name_kana: `${child.family_name_kana || ''} ${child.given_name_kana || ''}`.trim(),
        birth_date: child.birth_date,
        age: child.birth_date
          ? Math.floor(
              (new Date().getTime() - new Date(child.birth_date).getTime()) /
                (365.25 * 24 * 60 * 60 * 1000)
            )
          : null,
        enrollment_status: child.enrollment_status,
      }));

    return NextResponse.json({
      success: true,
      data: {
        added: addedChildren,
        inserted_records: inserts,
      },
      message: '児童をクラスに追加しました',
    });
  } catch (error) {
    console.error('Error adding children to class:', error);
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
