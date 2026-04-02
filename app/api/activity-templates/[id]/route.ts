import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { validateActivityExtendedFields } from '@/lib/validation/activityValidation';

/**
 * 活動記録テンプレート更新
 * PUT /api/activity-templates/[id]
 * staff 以上で実行可能
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, event_name, daily_schedule } = body;

    // テンプレート名バリデーション
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    if (name.length > 100) {
      return NextResponse.json(
        { error: 'name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // event_name / daily_schedule バリデーション
    const extendedFieldsResult = validateActivityExtendedFields({ event_name, daily_schedule });
    if (!extendedFieldsResult.valid) {
      return NextResponse.json({ error: extendedFieldsResult.error }, { status: 400 });
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

    if (existing.facility_id !== metadata.current_facility_id) {
      return NextResponse.json(
        { error: 'このテンプレートを更新する権限がありません' },
        { status: 403 }
      );
    }

    // staff 以上のみ編集可能（RLSとの二重防御）
    const allowedRoles = ['staff', 'facility_admin', 'company_admin', 'site_admin'];
    if (!allowedRoles.includes(metadata.role)) {
      return NextResponse.json(
        { error: 'テンプレートの編集には staff 以上の権限が必要です' },
        { status: 403 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('s_activity_templates')
      .update({
        name: name.trim(),
        event_name: extendedFieldsResult.data.event_name,
        daily_schedule: extendedFieldsResult.data.daily_schedule,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('activity-templates PUT error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template: updated });
  } catch (error) {
    console.error('activity-templates PUT unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // facility_admin 以上のみ削除可能
    const allowedRoles = ['facility_admin', 'company_admin', 'site_admin'];
    if (!allowedRoles.includes(metadata.role)) {
      return NextResponse.json(
        { error: 'テンプレートの削除にはfacility_admin以上の権限が必要です' },
        { status: 403 }
      );
    }

    const supabase = await createClient();
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

    if (existing.facility_id !== metadata.current_facility_id) {
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
