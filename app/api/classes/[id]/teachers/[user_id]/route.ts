import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { getCurrentDateJST } from '@/lib/utils/timezone';

/**
 * DELETE /api/classes/:id/teachers/:user_id
 * クラスから担任を削除
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; user_id: string }> }
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

    const { id: classId, user_id: teacherId } = await params;

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

    // 担任の割り当てを確認
    const { data: assignment, error: assignmentError } = await supabase
      .from('_user_class')
      .select('id')
      .eq('user_id', teacherId)
      .eq('class_id', classId)
      .eq('is_current', true)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { success: false, error: 'Teacher assignment not found' },
        { status: 404 }
      );
    }

    // 担任を解除（履歴として保持するため、is_currentをfalseにしてend_dateを設定）
    const today = getCurrentDateJST();
    const { error: updateError } = await supabase
      .from('_user_class')
      .update({
        is_current: false,
        end_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: teacherId,
        class_id: classId,
        removed_at: today,
      },
      message: '担任を解除しました',
    });
  } catch (error) {
    console.error('Error removing teacher from class:', error);
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
