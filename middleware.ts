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

/**
 * JWT ペイロードをデコードする（Edge Runtime 対応）
 * Edge Runtime では Buffer が使用不可なので atob() を使用
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );

        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

export async function middleware(request: NextRequest) {
    // CSRF Protection: Check Origin header for state-changing requests
    // Supabase uses SameSite=Lax cookies, but this adds an additional layer of defense
    if (['DELETE', 'PUT', 'POST', 'PATCH'].includes(request.method)) {
        const origin = request.headers.get('origin');
        const host = request.headers.get('host');

        // Same-origin check: origin must match the current host
        if (origin && host) {
            const originUrl = new URL(origin);
            if (originUrl.host !== host) {
                console.warn('CSRF attempt detected - origin mismatch:', {
                    origin: originUrl.host,
                    host,
                    method: request.method,
                    path: request.nextUrl.pathname,
                });
                return NextResponse.json(
                    { success: false, error: 'Invalid request origin' },
                    { status: 403 }
                );
            }
        }
    }

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

    // getSession() でセッションを取得（JWT からカスタムクレームを読み取るため）
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

    // JWT からカスタムクレーム（role）を取得
    let role: string | undefined;
    if (session?.access_token) {
        const payload = decodeJwtPayload(session.access_token);
        const appMetadata = payload?.app_metadata as Record<string, unknown> | undefined;
        role = appMetadata?.role as string | undefined;
    }

    // ログイン済みで /login にアクセス → role に基づいてリダイレクト
    if (session && request.nextUrl.pathname === '/login') {
        // site_admin / company_admin → /admin, その他 → /dashboard
        const redirectPath = (role === 'site_admin' || role === 'company_admin')
            ? '/admin'
            : '/dashboard';

        return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // /admin へのアクセス制御（site_admin / company_admin のみ許可）
    if (session && request.nextUrl.pathname.startsWith('/admin')) {
        // site_admin / company_admin 以外は /dashboard にリダイレクト
        if (role !== 'site_admin' && role !== 'company_admin') {
            return NextResponse.redirect(new URL('/dashboard', request.url));
        }
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)'],
};
