import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const cookieStore = await cookies();

    // CSRF保護: OriginヘッダーをURLとして解析し、ホスト名を厳密に比較
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        const expectedHost = host.split(':')[0]; // ポートを除去
        if (originUrl.hostname !== expectedHost) {
          console.warn('CSRF attempt blocked:', { origin, host });
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      } catch {
        // originが不正なURLの場合はブロック
        console.warn('Invalid origin header:', origin);
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 認証チェック: セッションが存在するか確認
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // 未認証でも成功として返す（既にログアウト済みの可能性）
      return NextResponse.json({ success: true, message: 'Already logged out' });
    }

    // Supabase セッションをクリア
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
    }

    // Supabase 関連の Cookie を明示的に削除（セキュア属性付き）
    const allCookies = cookieStore.getAll();
    for (const cookie of allCookies) {
      if (cookie.name.startsWith('sb-')) {
        cookieStore.set(cookie.name, '', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 0,
          path: '/',
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
