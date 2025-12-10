import { NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth/session';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        // セッションチェック（セキュリティのため）
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { user_id } = await request.json();

        // リクエストされたIDとトークンのIDが一致するか確認
        if (user_id !== session.user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
