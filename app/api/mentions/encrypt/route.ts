import { NextRequest, NextResponse } from 'next/server';
import { encryptChildId } from '@/utils/crypto/childIdEncryption';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

/**
 * 子供IDを暗号化してメンション用トークンを生成
 *
 * セキュリティのため、サーバーサイドでのみ暗号化を実行し、
 * ユーザーが自施設に属する子供のみ暗号化できるよう制御する。
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { childId } = body;

    // バリデーション：childIdが存在するか
    if (!childId || typeof childId !== 'string' || childId.trim() === '') {
      return NextResponse.json(
        { error: 'childId is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // バリデーション：UUIDフォーマットかチェック
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(childId)) {
      return NextResponse.json(
        { error: 'childId must be a valid UUID format' },
        { status: 400 }
      );
    }

    // アクセス制御：子供が自施設に属しているか確認
    const { data: children, error: childError } = await supabase
      .from('m_children')
      .select('id, facility_id')
      .eq('id', childId)
      .is('deleted_at', null);

    if (childError) {
      console.error('Database error:', childError);
      return NextResponse.json(
        { error: 'Failed to verify child access' },
        { status: 500 }
      );
    }

    if (!children || children.length === 0) {
      return NextResponse.json({ error: 'Child not found' }, { status: 404 });
    }

    const child = children[0];

    // ユーザーの現在の施設IDと子供の施設IDが一致するか確認
    if (child.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 暗号化
    const encryptedToken = encryptChildId(childId);

    return NextResponse.json({ encryptedToken });
  } catch (error) {
    console.error('Encryption API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
