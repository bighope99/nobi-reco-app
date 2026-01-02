import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// 起動時チェック: 本番環境でE2Eテストモードが有効になっていないか検証
// これは重大なセキュリティリスクであり、認証を完全にバイパスします
if (
  process.env.E2E_TEST === 'true' &&
  (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production')
) {
  const errorMessage = `
⚠️  FATAL SECURITY ERROR ⚠️
E2E_TEST=true is enabled in production environment!
This completely disables authentication and is a critical security vulnerability.

ACTION REQUIRED:
1. Remove E2E_TEST from production environment variables
2. Remove ENABLE_TEST_MOCKS from production environment variables
3. Restart the application
4. Add this check to your deployment checklist

Environment: NODE_ENV=${process.env.NODE_ENV}, VERCEL_ENV=${process.env.VERCEL_ENV}
`;
  console.error(errorMessage);
  throw new Error('E2E_TEST enabled in production - aborting for security');
}

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();

    // E2E テスト環境では認証チェックをスキップ（本番環境では決して実行されない）
    // セキュリティ: E2E_TEST=true AND 非本番環境の両方が必要
    const isE2ETest =
        process.env.E2E_TEST === 'true' &&
        process.env.NODE_ENV !== 'production' &&
        process.env.VERCEL_ENV !== 'production';

    if (isE2ETest) {
        console.warn(
            '[Middleware] ⚠️  E2E Test mode active - authentication bypassed (test environment only)'
        );
    }

    // 未ログインで /login 以外にアクセス → /login へリダイレクト
    const isPasswordSetup = request.nextUrl.pathname.startsWith('/password/setup');
    if (!session && request.nextUrl.pathname !== '/login' && !isPasswordSetup && !isE2ETest) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // ログイン済みで /login にアクセス → /dashboard へリダイレクト
    if (session && request.nextUrl.pathname === '/login') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)'],
};
