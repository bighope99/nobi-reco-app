import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth/session';
import { forbiddenResponse, getServerSession } from '@/lib/auth/server-session';

export async function POST(request: Request) {
    try {
        // セッションチェック（セキュリティのため）
        const sessionResult = await getServerSession();
        if ('errorResponse' in sessionResult) {
            return sessionResult.errorResponse;
        }

        const { session } = sessionResult;
        const { user_id } = await request.json();

        // リクエストされたIDとトークンのIDが一致するか確認
        if (user_id !== session.user.id) {
            return forbiddenResponse();
        }

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
