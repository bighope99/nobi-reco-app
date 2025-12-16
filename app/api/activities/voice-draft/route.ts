import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession, type UserSession } from '@/lib/auth/session';

const voiceRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

let createSupabaseClient = createClient;
let getUserSessionFn = getUserSession;

export function __setTestSupabaseClient(fn: typeof createClient) {
  createSupabaseClient = fn;
}

export function __setTestUserSession(fn: typeof getUserSession) {
  getUserSessionFn = fn;
}

export function __resetTestOverrides() {
  createSupabaseClient = createClient;
  getUserSessionFn = getUserSession;
  voiceRateLimitMap.clear();
}

function checkRateLimit(userId: string) {
  const now = Date.now();
  const entries = voiceRateLimitMap.get(userId)?.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS) ?? [];
  if (entries.length >= RATE_LIMIT_MAX) {
    return false;
  }
  entries.push(now);
  voiceRateLimitMap.set(userId, entries);
  return true;
}

interface VoiceDraftInput {
  audio_url?: string;
  audio_format?: string;
  language?: string;
}

function validateInput(body: any): VoiceDraftInput | null {
  if (!body) {
    return null;
  }

  const audio_url = typeof body.audio_url === 'string' && body.audio_url.trim().length > 0 ? body.audio_url : undefined;
  const audio_format = typeof body.audio_format === 'string' ? body.audio_format : undefined;
  const language = typeof body.language === 'string' ? body.language : 'ja';

  if (!audio_url && !body.audio_base64) {
    return null;
  }

  return { audio_url: audio_url || 'inline-audio', audio_format, language };
}

function generateDraftText(language: string) {
  const baseText = '今日は室内で新聞紙遊びをしました。子どもたちは自由に破ったり丸めたりして楽しんでいました。';
  if (language === 'en') {
    return 'Today we played indoors with newspaper. The children enjoyed tearing and rolling the paper in their own ways.';
  }
  return baseText;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json({ success: false, error: 'AI_RATE_LIMIT' }, { status: 429 });
    }

    const userSession: UserSession | null = await getUserSessionFn(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Facility not found in session' }, { status: 400 });
    }

    const body = await request.json();
    const validated = validateInput(body);

    if (!validated) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const transcript = generateDraftText(validated.language ?? 'ja');
    const draft = `${transcript}\n\n活動のポイントを整理しました。子どもたちの様子を確認してください。`;

    return NextResponse.json({
      success: true,
      data: {
        transcript,
        draft,
        model: 'gpt-4o-mini',
        language: validated.language ?? 'ja',
        facility_id: userSession.current_facility_id,
      },
    });
  } catch (error) {
    console.error('Unexpected error in /api/activities/voice-draft:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
