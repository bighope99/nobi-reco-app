import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import type { TodoItem } from '@/types/activity';

/**
 * PATCH /api/handover/[id]/complete
 *
 * 引き継ぎの完了/未完了をトグルする
 *
 * Path Parameters:
 * - id: 保育日誌のID（r_activity.id）
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
    const body = await request.json().catch(() => undefined);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Request body must be a JSON object' },
        { status: 400 }
      );
    }
    const { completed, todo_item_id } = body as { completed?: unknown; todo_item_id?: unknown };

    if (typeof completed !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'completed must be a boolean' },
        { status: 400 }
      );
    }

    if (todo_item_id !== undefined && typeof todo_item_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'todo_item_id must be a string' },
        { status: 400 }
      );
    }

    // 対象の保育日誌が存在し、同じ施設であることを確認
    const { data: activity, error: fetchError } = await supabase
      .from('r_activity')
      .select('id, facility_id, handover, todo_items')
      .eq('id', id)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Activity not found' },
          { status: 404 }
        );
      }
      console.error('Failed to fetch activity:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    if (!activity) {
      return NextResponse.json(
        { success: false, error: 'Activity not found' },
        { status: 404 }
      );
    }

    // todo_item_id が指定された場合: ToDoアイテムの completed フラグを更新
    if (todo_item_id) {
      const currentTodoItems = activity.todo_items as TodoItem[] | null;
      if (!Array.isArray(currentTodoItems)) {
        return NextResponse.json(
          { success: false, error: 'This activity has no todo items' },
          { status: 400 }
        );
      }

      const targetItem = currentTodoItems.find((item) => item.id === todo_item_id);
      if (!targetItem) {
        return NextResponse.json(
          { success: false, error: 'Todo item not found' },
          { status: 404 }
        );
      }

      const updatedTodoItems = currentTodoItems.map((item) =>
        item.id === todo_item_id ? { ...item, completed } : item
      );

      const { data: updated, error: updateError } = await supabase
        .from('r_activity')
        .update({ todo_items: updatedTodoItems })
        .eq('id', id)
        .eq('facility_id', facility_id)
        .eq('todo_items', JSON.stringify(currentTodoItems))
        .is('deleted_at', null)
        .select('id');

      if (updateError) {
        console.error('Failed to update todo item:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update todo item' },
          { status: 500 }
        );
      }

      if (!updated || updated.length === 0) {
        return NextResponse.json(
          { success: false, error: '更新に失敗しました。再試行してください' },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          activity_id: id,
          todo_item_id,
          completed,
        },
      });
    }

    // todo_item_id が未指定の場合: 既存の handover_completed を更新（後方互換性維持）
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
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .not('handover', 'is', null)
      .neq('handover', '')
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
