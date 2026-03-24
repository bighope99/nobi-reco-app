import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/tags/[id]
 * タグ使用件数取得（site_adminのみ）
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (metadata.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const supabase = await createClient();

    const { count, error } = await supabase
      .from('_record_tag')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data: { usage_count: count ?? 0 } });
  } catch (error) {
    console.error('Error fetching tag usage count:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/tags/[id]
 * タグ更新（site_adminのみ）
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (metadata.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (name.length === 0) {
        return NextResponse.json(
          { success: false, error: 'タグ名は必須です' },
          { status: 400 }
        );
      }
      if (name.length > 50) {
        return NextResponse.json(
          { success: false, error: 'タグ名は50文字以内で入力してください' },
          { status: 400 }
        );
      }
      updateData.name = name;
    }

    if (body.name_en !== undefined) updateData.name_en = body.name_en ? String(body.name_en).trim() : null;
    if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
    if (body.color !== undefined) updateData.color = body.color || null;
    if (body.sort_order !== undefined) updateData.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);

    const supabase = await createClient();

    const { data: tag, error } = await supabase
      .from('m_observation_tags')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'このタグ名はすでに使用されています' },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!tag) {
      return NextResponse.json(
        { success: false, error: 'タグが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { tag } });
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/tags/[id]
 * タグ論理削除（site_adminのみ）
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (metadata.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const supabase = await createClient();

    const { error, count } = await supabase
      .from('m_observation_tags')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    if (count === 0) {
      return NextResponse.json(
        { success: false, error: 'タグが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
