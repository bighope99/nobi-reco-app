import { NextResponse } from 'next/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { getUserSession } from '@/lib/auth/session';

export async function POST(request: Request) {
    try {
        // 認証チェック（JWT署名検証済みメタデータから取得）
        const metadata = await getAuthenticatedUserMetadata();
        if (!metadata) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { user_id } = await request.json();

        // リクエストされたIDとトークンのIDが一致するか確認
        if (user_id !== metadata.user_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // フルセッションデータを取得（フロントエンド用）
        const sessionData = await getUserSession(user_id);

        if (!sessionData) {
            return NextResponse.json({ error: 'User data not found' }, { status: 404 });
        }

        return NextResponse.json(sessionData);
    } catch (error) {
        console.error('Session API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
