import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';
import { buildPersonalRecordPrompt } from '@/lib/ai/prompts';

type ObservationTag = {
  id: string;
  name: string;
  description: string | null;
};

const splitObjectiveSubjective = (text: string) => {
  const subjectiveHints = ['と思う', '感じ', 'そう', 'らしい', 'かもしれ', 'ようだ', '配慮', '方針', '評価'];
  const lines = text.split('\n');
  const objectiveLines: string[] = [];
  const subjectiveLines: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      objectiveLines.push(line);
      return;
    }
    const isSubjective = subjectiveHints.some((hint) => trimmed.includes(hint));
    if (isSubjective) {
      subjectiveLines.push(line);
    } else {
      objectiveLines.push(line);
    }
  });

  return {
    objective: objectiveLines.join('\n').trim(),
    subjective: subjectiveLines.join('\n').trim(),
  };
};

const extractJsonPayload = (rawText: string) => {
  const cleaned = rawText
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI解析結果のJSONが見つかりませんでした');
  }
  const payload = cleaned.slice(start, end + 1);
  return JSON.parse(payload);
};

const normalizeAiOutput = (raw: unknown, tags: ObservationTag[]) => {
  if (!Array.isArray(raw) || raw.length === 0 || typeof raw[0] !== 'object' || raw[0] === null) {
    throw new Error('AI解析結果の形式が不正です');
  }
  const record = raw[0] as Record<string, unknown>;
  const objective = typeof record.objective === 'string' ? record.objective : '';
  const subjective = typeof record.subjective === 'string' ? record.subjective : '';
  const flags = tags.reduce<Record<string, number>>((acc, tag) => {
    const rawValue = record[tag.name];
    const numeric = typeof rawValue === 'number' ? rawValue : rawValue ? 1 : 0;
    acc[tag.id] = numeric === 1 ? 1 : 0;
    return acc;
  }, {});
  return { objective, subjective, flags };
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getUserSession(user.id);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      return NextResponse.json({ success: false, error: '本文を入力してください' }, { status: 400 });
    }

    const { data: tags, error: tagError } = await supabase
      .from('m_observation_tags')
      .select('id, name, description')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order');

    if (tagError) {
      console.error('Failed to load observation tags:', tagError);
      return NextResponse.json({ success: false, error: tagError.message }, { status: 500 });
    }

    const tagList = (tags as ObservationTag[]) || [];
    const prompt = buildPersonalRecordPrompt(text, tagList);
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GeminiのAPIキーが設定されていません' }, { status: 500 });
    }

    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      apiKey,
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    const response = await model.invoke([new HumanMessage(prompt)]);
    const responseText = typeof response.content === 'string' ? response.content : response.content.toString();

    let objective = '';
    let subjective = '';
    let flags: Record<string, number> = {};
    try {
      const payload = extractJsonPayload(responseText);
      const normalized = normalizeAiOutput(payload, tagList);
      objective = normalized.objective;
      subjective = normalized.subjective;
      flags = normalized.flags;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      const fallback = splitObjectiveSubjective(text);
      objective = fallback.objective;
      subjective = fallback.subjective;
      flags = tagList.reduce<Record<string, number>>((acc, tag) => {
        acc[tag.id] = text.includes(tag.name) ? 1 : 0;
        return acc;
      }, {});
    }

    return NextResponse.json({
      success: true,
      data: {
        prompt,
        objective,
        subjective,
        flags,
      },
    });
  } catch (error) {
    console.error('Observation AI API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
