import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint for Supabase auth user updates
 * This route allows test mocking of the /auth/v1/user endpoint
 */
export async function PUT(request: NextRequest) {
  console.log("[API /auth/v1/user] PUT request received");
  return handleUserUpdate(request);
}

export async function PATCH(request: NextRequest) {
  console.log("[API /auth/v1/user] PATCH request received");
  return handleUserUpdate(request);
}

async function handleUserUpdate(request: NextRequest) {
  try {
    const body = await request.json();

    // 開発環境でのみ詳細ログを出力（パスワードなどの機密情報は含めない）
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
      console.log("[API /auth/v1/user] Request details:", {
        hasPassword: !!body.password,
        hasEmail: !!body.email,
      });
    } else {
      console.log("[API /auth/v1/user] User update request received");
    }

    // テスト環境の検証（本番環境では決して実行されない）
    // セキュリティ: モック機能は明示的なE2Eテストフラグでのみ有効化
    // E2Eテストフラグが必須
    const isE2ETest = process.env.E2E_TEST === "true";
    const isTestEnvironment =
      process.env.NODE_ENV === "test" ||
      process.env.ENABLE_TEST_MOCKS === "true";

    // E2Eテスト環境でのみモックレスポンスを許可
    if (isE2ETest && isTestEnvironment) {
      console.log("[API /auth/v1/user] ⚠️  TEST MODE: Returning mock response");
      console.log("[API /auth/v1/user] Environment check:", {
        NODE_ENV: process.env.NODE_ENV,
        E2E_TEST: process.env.E2E_TEST,
        ENABLE_TEST_MOCKS: process.env.ENABLE_TEST_MOCKS,
        isE2ETest,
        isTestEnvironment,
      });
      console.warn(
        "[Security] ⚠️  Mock user update is enabled - this should only run in E2E test environments"
      );
      return NextResponse.json({
        user: {
          id: "user-1",
          email: "user@example.com",
        },
      });
    }

    // 本番環境：Supabaseにプロキシ
    console.log("[API /auth/v1/user] Production mode: proxying to Supabase");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error("Missing Supabase configuration");
    }

    // リクエストヘッダーからAuthorizationを取得
    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      return NextResponse.json(
        { error: "Missing authorization header" },
        { status: 401 }
      );
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "apikey": anonKey,
        "Authorization": authorization,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[API /auth/v1/user] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
