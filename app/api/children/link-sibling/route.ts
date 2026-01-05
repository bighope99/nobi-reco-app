import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

interface LinkSiblingRequest {
  child_id: string;
  sibling_id: string;
}

/**
 * POST /api/children/link-sibling - 兄弟姉妹の紐付け
 *
 * リクエストボディ:
 * {
 *   "child_id": "uuid",
 *   "sibling_id": "uuid"
 * }
 *
 * レスポンス:
 * {
 *   "success": true,
 *   "data": {
 *     "sibling_name": "山田 太郎"
 *   },
 *   "message": "兄弟姉妹を紐付けました"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // JWT認証チェック
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id } = metadata;
    if (!current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    // リクエストボディの取得
    const body: LinkSiblingRequest = await request.json();
    const { child_id, sibling_id } = body;

    // バリデーション
    if (!child_id || !sibling_id) {
      return NextResponse.json(
        { error: 'child_id and sibling_id are required' },
        { status: 400 }
      );
    }

    if (child_id === sibling_id) {
      return NextResponse.json(
        { error: 'Cannot link a child to themselves' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 両方の子どもが同じ施設に所属しているか確認
    const { data: childrenData, error: childrenError } = await supabase
      .from('m_children')
      .select('id, family_name, given_name, facility_id')
      .in('id', [child_id, sibling_id])
      .eq('facility_id', current_facility_id)
      .is('deleted_at', null);

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json(
        { error: 'Failed to fetch children' },
        { status: 500 }
      );
    }

    if (!childrenData || childrenData.length !== 2) {
      return NextResponse.json(
        { error: 'One or both children not found in current facility' },
        { status: 404 }
      );
    }

    // 既存の紐付けがあるかチェック
    const { data: existingLink } = await supabase
      .from('_child_sibling')
      .select('id')
      .eq('child_id', child_id)
      .eq('sibling_id', sibling_id)
      .single();

    if (existingLink) {
      return NextResponse.json(
        { error: 'Sibling relationship already exists' },
        { status: 409 }
      );
    }

    // 双方向の紐付けレコードを作成
    const siblingRecords = [
      {
        child_id,
        sibling_id,
        relationship: '兄弟',
      },
      {
        child_id: sibling_id,
        sibling_id: child_id,
        relationship: '兄弟',
      },
    ];

    const { error: insertError } = await supabase
      .from('_child_sibling')
      .insert(siblingRecords);

    if (insertError) {
      console.error('Sibling link creation error:', insertError);
      return NextResponse.json(
        { error: 'Failed to link siblings' },
        { status: 500 }
      );
    }

    // 紐付けた兄弟の名前を取得してレスポンスに含める
    const siblingInfo = childrenData.find((c: any) => c.id === sibling_id);
    const siblingName = siblingInfo
      ? `${siblingInfo.family_name} ${siblingInfo.given_name}`
      : '';

    return NextResponse.json({
      success: true,
      data: {
        sibling_name: siblingName,
      },
      message: '兄弟姉妹を紐付けました',
    });
  } catch (error) {
    console.error('Link sibling API error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
