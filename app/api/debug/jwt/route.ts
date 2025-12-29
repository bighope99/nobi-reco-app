import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * デバッグ用: 現在のJWTトークンのapp_metadataを確認
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authError?.message },
      { status: 401 }
    );
  }

  const user = session.user;

  // JWTトークン全体をデコード
  const accessToken = session.access_token;
  const tokenParts = accessToken.split('.');
  const payload = tokenParts.length > 1
    ? JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
    : null;

  return NextResponse.json({
    user_id: user.id,
    email: user.email,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    jwt_payload: payload,
    full_session: session,
  });
}
