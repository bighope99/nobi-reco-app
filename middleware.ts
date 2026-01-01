import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

    // E2E テスト環境では認証チェックをスキップ
    // (テスト用のモックトークンは有効なJWTではないため)
    const isE2ETest = process.env.E2E_TEST === 'true';

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
