import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * POST /api/classes/:id/teachers
 * クラスに担任を追加
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    // JWTメタデータから認証情報を取得
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role, company_id, current_facility_id } = metadata;

    // 権限チェック（staffは更新不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id: classId } = await params;

    // クラスの存在確認
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

    // 施設アクセス権限チェック
    if (role === 'facility_admin') {
      if (current_facility_id !== classData.facility_id) {
        return NextResponse.json(
          { success: false, error: 'Class not found' },
          { status: 404 }
        );
      }
    }

    const body = await request.json();
    const { user_id, class_role = 'main' } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: 'user_id is required' },
        { status: 400 }
      );
    }

    // 追加する職員が存在するか確認
    const { data: teacherData, error: teacherError } = await supabase
      .from('m_users')
      .select('id, name, role')
      .eq('id', user_id)
      .is('deleted_at', null)
      .single();

    if (teacherError || !teacherData) {
      return NextResponse.json(
        { success: false, error: 'Teacher not found' },
        { status: 404 }
      );
    }

    // すでに担任として登録されていないか確認
    const { data: existingAssignment } = await supabase
      .from('_user_class')
      .select('id')
      .eq('user_id', user_id)
      .eq('class_id', classId)
      .eq('is_current', true)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'Teacher already assigned to this class' },
        { status: 400 }
      );
    }

    // 担任を追加
    const { data: newAssignment, error: insertError } = await supabase
      .from('_user_class')
      .insert({
        user_id,
        class_id: classId,
        class_role,
        start_date: new Date().toISOString().split('T')[0],
        is_current: true,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      data: {
        assignment_id: newAssignment.id,
        user_id: teacherData.id,
        name: teacherData.name,
        role: teacherData.role,
        class_role,
      },
      message: '担任を追加しました',
    });
  } catch (error) {
    console.error('Error adding teacher to class:', error);
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
