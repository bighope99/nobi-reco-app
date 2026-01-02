import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * PUT /api/users/:id
 * 職員情報更新
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
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

    const { role, company_id } = metadata;

    // 認証済みユーザーIDを取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: targetUserId } = params;

    // 対象ユーザーの存在確認
    const { data: targetUser, error: targetUserError } = await supabase
      .from('m_users')
      .select('id, name, role, company_id')
      .eq('id', targetUserId)
      .is('deleted_at', null)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 権限チェック
    const isSelf = user.id === targetUserId;
    const isStaff = role === 'staff';

    if (isStaff && !isSelf) {
      // Staffは自分自身のみ編集可能
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 自分自身のロール変更を防止
    if (isSelf && body.role && body.role !== targetUser.role) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify your own role' },
        { status: 400 }
      );
    }

    // Staffは自分のロール・クラス担当を変更不可
    if (isStaff && (body.role || body.assigned_classes)) {
      return NextResponse.json(
        { success: false, error: 'Staff cannot modify role or class assignments' },
        { status: 403 }
      );
    }

    // 更新データ準備
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.name_kana !== undefined) updateData.name_kana = body.name_kana;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.birth_date !== undefined) updateData.birth_date = body.birth_date;
    if (body.position !== undefined) updateData.position = body.position;
    if (body.employment_type !== undefined) updateData.employment_type = body.employment_type;
    if (body.is_active !== undefined && !isStaff) updateData.is_active = body.is_active;
    if (body.role !== undefined && !isStaff) updateData.role = body.role;

    // ユーザー情報更新
    const { data: updatedUser, error: updateError } = await supabase
      .from('m_users')
      .update(updateData)
      .eq('id', targetUserId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // クラス担当更新（管理者のみ）
    if (body.assigned_classes && !isStaff) {
      // 既存の担当を終了
      await supabase
        .from('_user_class')
        .update({
          is_current: false,
          end_date: new Date().toISOString().split('T')[0],
        })
        .eq('user_id', targetUserId)
        .eq('is_current', true);

      // 新しい担当を追加
      if (body.assigned_classes.length > 0) {
        const classAssignments = body.assigned_classes.map((assignment: any) => ({
          user_id: targetUserId,
          class_id: assignment.class_id,
          is_main: assignment.is_main || false,
          start_date: assignment.start_date || new Date().toISOString().split('T')[0],
          is_current: true,
        }));

        await supabase.from('_user_class').insert(classAssignments);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: updatedUser.id,
        name: updatedUser.name,
        role: updatedUser.role,
        updated_at: updatedUser.updated_at,
      },
      message: '職員情報を更新しました',
    });
  } catch (error) {
    console.error('Error updating user:', error);
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

/**
 * DELETE /api/users/:id
 * 職員削除（無効化）
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
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

    const { role } = metadata;

    // 認証済みユーザーIDを取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 権限チェック（staffは削除不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id: targetUserId } = params;

    // 自分自身の削除を防止
    if (user.id === targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // 対象ユーザーの存在確認
    const { data: targetUser, error: targetUserError } = await supabase
      .from('m_users')
      .select('id, name, role')
      .eq('id', targetUserId)
      .is('deleted_at', null)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const deletedAt = new Date().toISOString();

    // ユーザー無効化（ソフトデリート）
    const { error: deleteError } = await supabase
      .from('m_users')
      .update({
        is_active: false,
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('id', targetUserId);

    if (deleteError) {
      throw deleteError;
    }

    // クラス担当を終了
    const { error: classUpdateError } = await supabase
      .from('_user_class')
      .update({
        is_current: false,
        end_date: deletedAt.split('T')[0],
      })
      .eq('user_id', targetUserId)
      .eq('is_current', true);

    if (classUpdateError) {
      console.error('Failed to update _user_class:', classUpdateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update class assignments',
          message: classUpdateError.message,
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = await createAdminClient();
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      targetUserId
    );

    if (authDeleteError) {
      console.error('Failed to delete auth user:', authDeleteError);
      throw authDeleteError;
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: targetUser.id,
        name: targetUser.name,
        is_active: false,
        deactivated_at: deletedAt,
      },
      message: '職員アカウントを無効化しました',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
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
