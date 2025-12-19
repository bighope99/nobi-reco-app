import { NextResponse } from 'next/server';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type SessionResult =
  | {
      supabase: SupabaseServerClient;
      session: Session;
    }
  | {
      errorResponse: NextResponse;
    };

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Forbidden';

export const unauthorizedResponse = (
  message = UNAUTHORIZED_MESSAGE,
  code = 'UNAUTHORIZED'
) =>
  NextResponse.json(
    { success: false, error: { code, message } },
    { status: 401 }
  );

export const forbiddenResponse = (
  message = FORBIDDEN_MESSAGE,
  code = 'FORBIDDEN'
) =>
  NextResponse.json(
    { success: false, error: { code, message } },
    { status: 403 }
  );

export async function getServerSession(
  supabaseClient?: SupabaseServerClient
): Promise<SessionResult> {
  const supabase = supabaseClient ?? (await createClient());
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return { errorResponse: unauthorizedResponse() };
  }

  return { supabase, session };
}
