import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * GET /api/admin/tags
 * タグ一覧取得（site_adminのみ）
 */
export async function GET() {
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

    const supabase = await createClient();

    const { data: tags, error } = await supabase
      .from('m_observation_tags')
      .select('id, name, name_en, description, color, sort_order, is_active, created_at, updated_at')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: { tags: tags || [], total: (tags || []).length },
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tags
 * タグ新規作成（site_adminのみ）
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'タグ名は必須です' },
        { status: 400 }
      );
    }

    const name = String(body.name).trim();
    if (name.length > 50) {
      return NextResponse.json(
        { success: false, error: 'タグ名は50文字以内で入力してください' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: tag, error } = await supabase
      .from('m_observation_tags')
      .insert({
        name,
        name_en: body.name_en ? String(body.name_en).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        color: body.color || null,
        sort_order: typeof body.sort_order === 'number' ? body.sort_order : 0,
        is_active: body.is_active !== false,
      })
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

    return NextResponse.json({ success: true, data: { tag } }, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
