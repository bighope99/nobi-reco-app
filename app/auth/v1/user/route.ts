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
    console.log("[API /auth/v1/user] Request body:", { hasPassword: !!body.password });

    // E2Eテストモードの場合のみモックレスポンスを返す
    if (process.env.E2E_TEST === "true") {
      console.log("[API /auth/v1/user] Test mode: returning mock response");
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
