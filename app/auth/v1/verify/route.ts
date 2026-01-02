import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint for Supabase auth verification
 * This route allows test mocking of the /auth/v1/verify endpoint
 */
export async function POST(request: NextRequest) {
  console.log("[API /auth/v1/verify] Request received");
  try {
    const body = await request.json();

    // 開発環境でのみ詳細ログを出力（本番環境では機密情報を含めない）
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.log("[API /auth/v1/verify] Request details:", {
        type: body.type,
        token_hash: body.token_hash ? '[REDACTED]' : undefined,
      });
    } else {
      console.log("[API /auth/v1/verify] Verify request for type:", body.type);
    }

    // テスト環境の検証（本番環境では決して実行されない）
    // セキュリティ: モック機能は明示的な環境変数フラグでのみ有効化
    const isTestEnvironment =
      process.env.NODE_ENV === "test" ||
      process.env.ENABLE_TEST_MOCKS === "true";

    // テスト環境でのみモックレスポンスを許可
    if (
      isTestEnvironment &&
      body.token_hash === "valid-token" &&
      body.type === "invite"
    ) {
      console.log("[API /auth/v1/verify] ⚠️  TEST MODE: Mock authentication path activated");
      console.log("[API /auth/v1/verify] Environment check:", {
        NODE_ENV: process.env.NODE_ENV,
        ENABLE_TEST_MOCKS: process.env.ENABLE_TEST_MOCKS,
        isTestEnvironment,
      });
      console.warn(
        "[Security] ⚠️  Mock authentication is enabled - this should only run in test environments"
      );
      return NextResponse.json({
        access_token: "access-token",
        refresh_token: "refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    console.log("[API /auth/v1/verify] Supabase config:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!anonKey,
    });

    if (!supabaseUrl || !anonKey) {
      console.error("[API /auth/v1/verify] Missing Supabase configuration");
      return NextResponse.json(
        { error: "Supabase configuration missing" },
        { status: 500 }
      );
    }

    console.log("[API /auth/v1/verify] Proxying to Supabase...");
    const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });

    console.log("[API /auth/v1/verify] Supabase response status:", response.status);
    const data = await response.json();

    if (!response.ok) {
      console.error("[API /auth/v1/verify] Supabase error:", data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log("[API /auth/v1/verify] Success, returning session data");
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /auth/v1/verify] Proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
