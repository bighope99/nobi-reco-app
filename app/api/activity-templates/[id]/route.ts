import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

/**
 * 活動記録テンプレート削除（論理削除）
 * DELETE /api/activity-templates/[id]
 * facility_admin 以上のみ実行可能
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // facility_admin 以上のみ削除可能
    const allowedRoles = ['facility_admin', 'company_admin', 'site_admin'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'テンプレートの削除にはfacility_admin以上の権限が必要です' },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // テンプレートの存在確認と施設IDチェック
    const { data: existing, error: fetchError } = await supabase
      .from('s_activity_templates')
      .select('id, facility_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'テンプレートが見つかりませんでした' },
        { status: 404 }
      );
    }

    if (existing.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'このテンプレートを削除する権限がありません' },
        { status: 403 }
      );
    }

    const deletedAt = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from('s_activity_templates')
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq('id', id);

    if (deleteError) {
      console.error('activity-templates DELETE error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id, message: 'テンプレートを削除しました' });
  } catch (error) {
    console.error('activity-templates DELETE unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
