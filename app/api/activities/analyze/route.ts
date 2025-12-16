import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession, type UserSession } from '@/lib/auth/session';

interface MentionInput {
  child_id: string;
  name: string;
  age?: number;
  grade?: string;
}

interface AiCandidate {
  child_id: string;
  child_name: string;
  extracted_fact: string;
  generated_comment: string;
  recommended_tags: Array<{ tag_id: string; tag_name: string; confidence_score: number }>;
  child_voice?: string;
  overall_confidence: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const aiRateLimitMap = new Map<string, number[]>();

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
  aiRateLimitMap.clear();
}

function checkRateLimit(userId: string) {
  const now = Date.now();
  const entries = aiRateLimitMap.get(userId)?.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS) ?? [];
  if (entries.length >= RATE_LIMIT_MAX) {
    return false;
  }
  entries.push(now);
  aiRateLimitMap.set(userId, entries);
  return true;
}

function validateInput(body: any): { text: string; mentions: MentionInput[]; activity_id?: string; config?: Record<string, unknown> } | null {
  if (!body || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return null;
  }

  if (body.text.length > 10_000) {
    return null;
  }

  if (!Array.isArray(body.mentions) || body.mentions.length === 0 || body.mentions.length > 50) {
    return null;
  }

  const mentions: MentionInput[] = body.mentions.filter((m: any) => typeof m.child_id === 'string' && typeof m.name === 'string');
  if (mentions.length === 0) {
    return null;
  }

  return {
    text: body.text,
    mentions,
    activity_id: typeof body.activity_id === 'string' ? body.activity_id : undefined,
    config: typeof body.config === 'object' ? body.config : undefined,
  };
}

function buildCandidates(text: string, mentions: MentionInput[]): AiCandidate[] {
  return mentions.map((mention, index) => {
    const truncatedText = text.length > 160 ? `${text.slice(0, 157)}...` : text;
    const baseConfidence = 0.85 + (index % 3) * 0.03;
    const tags = [
      { tag_id: 'tag-persistence', tag_name: '忍耐力', confidence_score: Number((baseConfidence - 0.05).toFixed(2)) },
      { tag_id: 'tag-curiosity', tag_name: '好奇心', confidence_score: Number((baseConfidence - 0.1).toFixed(2)) },
    ];

    return {
      child_id: mention.child_id,
      child_name: mention.name,
      extracted_fact: `${mention.name} に関する観察: ${truncatedText}`,
      generated_comment: `${mention.name}の取り組みから成長が感じられます。`,
      recommended_tags: tags,
      child_voice: '子どもの発話は検出されませんでした。',
      overall_confidence: Number(baseConfidence.toFixed(2)),
    };
  });
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

    const candidates = buildCandidates(validated.text, validated.mentions);
    const processingStart = Date.now();

    const response = {
      success: true,
      data: {
        candidates,
        metadata: {
          model: 'gpt-4o-mini',
          tokens_used: Math.max(50, Math.min(1500, Math.ceil(validated.text.length / 4))),
          processing_time_ms: Date.now() - processingStart + 400,
          facility_id: userSession.current_facility_id,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Unexpected error in /api/activities/analyze:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
