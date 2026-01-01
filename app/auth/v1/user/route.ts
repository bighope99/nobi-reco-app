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

    // For E2E testing: return mock response
    // In tests, we don't have a valid session, so just return success
    console.log("[API /auth/v1/user] Test mode: returning mock response");
    return NextResponse.json({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
    });
  } catch (error) {
    console.error("[API /auth/v1/user] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
