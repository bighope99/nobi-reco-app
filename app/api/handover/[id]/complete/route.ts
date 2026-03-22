import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * PATCH /api/handover/[id]/complete
 *
 * 引き継ぎの完了/未完了をトグルする
 *
 * Path Parameters:
 * - id: 活動記録のID（r_activity.id）
 *
 * Request Body:
 * - completed: boolean（true: 完了, false: 未完了）
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     activity_id: "...",
 *     handover_completed: true,
 *     handover_completed_at: "...",
 *     handover_completed_by: "..."
 *   }
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // 認証チェック
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const facility_id = metadata.current_facility_id;
    const user_id = metadata.user_id;

    // UUID形式チェック
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid activity ID format' },
        { status: 400 }
      );
    }

    // リクエストボディ取得
    const body = await request.json();
    const { completed } = body;

    if (typeof completed !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'completed must be a boolean' },
        { status: 400 }
      );
    }

    // 対象の活動記録が存在し、引き継ぎがあり、同じ施設であることを確認
    const { data: activity, error: fetchError } = await supabase
      .from('r_activity')
      .select('id, facility_id, handover')
      .eq('id', id)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !activity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    if (!activity.handover) {
      return NextResponse.json(
        { success: false, error: 'This activity has no handover content' },
        { status: 400 }
      );
    }

    // 完了状態を更新
    const updateData = completed
      ? {
          handover_completed: true,
          handover_completed_at: new Date().toISOString(),
          handover_completed_by: user_id,
        }
      : {
          handover_completed: false,
          handover_completed_at: null,
          handover_completed_by: null,
        };

    const { data: updated, error: updateError } = await supabase
      .from('r_activity')
      .update(updateData)
      .eq('id', id)
      .select('id, handover_completed, handover_completed_at, handover_completed_by')
      .single();

    if (updateError) {
      console.error('Failed to update handover completion:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update handover completion' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        activity_id: updated.id,
        handover_completed: updated.handover_completed,
        handover_completed_at: updated.handover_completed_at,
        handover_completed_by: updated.handover_completed_by,
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
