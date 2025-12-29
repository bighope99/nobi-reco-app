import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * PUT /api/schools/:school_id
 * 学校情報更新
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ school_id: string }> }
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

    const { role, current_facility_id } = metadata;

    // 権限チェック（staffは更新不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { school_id } = params;

    // 学校の存在確認と権限チェック
    const { data: school, error: schoolError } = await supabase
      .from('m_schools')
      .select('id, name, facility_id, address, phone')
      .eq('id', school_id)
      .is('deleted_at', null)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { success: false, error: 'School not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (role === 'facility_admin' || role === 'staff') {
      if (current_facility_id !== school.facility_id) {
        return NextResponse.json(
          { success: false, error: 'School not found' },
          { status: 404 }
        );
      }
    }

    const body = await request.json();

    // 学校情報更新
    const { data: updatedSchool, error: updateError } = await supabase
      .from('m_schools')
      .update({
        name: body.name || school.name,
        address: body.address !== undefined ? body.address : school.address,
        phone: body.phone !== undefined ? body.phone : school.phone,
        updated_at: new Date().toISOString(),
        // 必要に応じて他のフィールドも追加
      })
      .eq('id', school_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        school_id: updatedSchool.id,
        name: updatedSchool.name,
        updated_at: updatedSchool.updated_at,
      },
      message: '学校情報を更新しました',
    });
  } catch (error) {
    console.error('Error updating school:', error);
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
 * DELETE /api/schools/:school_id
 * 学校削除（ソフトデリート）
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ school_id: string }> }
) {
  const params = await props.params;
  try {
    const supabase = await createClient();

    // 認証チェック
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

    // ユーザー情報取得
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

    // 権限チェック（staffは削除不可）
    if (userData.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { school_id } = params;

    // 学校の存在確認と権限チェック
    const { data: school, error: schoolError } = await supabase
      .from('m_schools')
      .select('id, name, facility_id')
      .eq('id', school_id)
      .is('deleted_at', null)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { success: false, error: 'School not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (role === 'facility_admin' || role === 'staff') {
      if (current_facility_id !== school.facility_id) {
        return NextResponse.json(
          { success: false, error: 'School not found' },
          { status: 404 }
        );
      }
    }

    const deletedAt = new Date().toISOString();

    // 学校を削除（ソフトデリート）
    const { error: deleteError } = await supabase
      .from('m_schools')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('id', school_id);

    if (deleteError) {
      throw deleteError;
    }

    // 関連するスケジュールも削除
    await supabase
      .from('s_school_schedules')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('school_id', school_id)
      .is('deleted_at', null);

    return NextResponse.json({
      success: true,
      data: {
        school_id: school.id,
        name: school.name,
        deleted_at: deletedAt,
      },
      message: '学校を削除しました',
    });
  } catch (error) {
    console.error('Error deleting school:', error);
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
