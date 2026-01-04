import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage } from '@langchain/core/messages';

type ObservationTag = {
  id: string;
  name: string;
  description: string | null;
};

const buildPrompt = (text: string, tags: ObservationTag[]) => {
  const tagLines = tags.length
    ? tags.map((tag) => `- "${tag.name}": ${tag.description || '該当する場合は1'}`).join('\n')
    : '- タグなし';
  const schemaSource = tags.length ? tags : [{ id: 'tag', name: 'tag', description: null }];
  const tagSchemaLines = schemaSource.map(
    (tag, index) => `    "${tag.name}": 0${index < schemaSource.length - 1 ? ',' : ''}`,
  );

  return [
    'あなたは記録整理の専門家です。',
    'インプットは「本文」のみで、インプット全体が**常に1レコード**です（分割は不要）。',
    '本文は観察記録のみ（担当者名なし）。',
    '以下の仕様で“変形のみ”を行い、**JSON配列1要素のみ**を出力してください（前後の解説や余計な文字は禁止）。',
    '',
    '【入力】',
    `本文: ${text}`,
    '',
    '【タスク】',
    'インプット全体（本文の改行も含む）を1レコードとして扱い、下記フィールドを持つ1つのオブジェクトを生成し、配列で返す。',
    '',
    '【JSONフィールド仕様】',
    '- "objective": 文字列。**客観**：観察事実・行動・発言・手順など実際に起きた事柄のみを**原文のまま**格納。**改行は維持**し、JSONでは \\n として表現。要約・言い換え・削除は禁止。',
    '- "subjective": 文字列。**主観**：推測される気持ち／評価／配慮／方針などの解釈に当たる文を**原文のまま**格納。無ければ空文字 ""。**改行は維持**し、JSONでは \\n として表現。',
    '- 重要：**入力本文の全テキストは必ず objective または subjective のどちらかに完全に割り当てる**（欠落禁止）。両者の和（順序維持・テキスト連結時に区別可能）が、見出し等を除く元本文と同量・同内容になること。',
    '',
    '【客観/主観の仕分け基準】',
    '- 客観（objective）：出来事の列挙、行動・発言の記録、具体的手順・結果、時間・場所・人数などの事実。',
    '- 主観（subjective）：感情・意図の推測（～そう／～らしい／～と思う）、評価語（偉い／難しい等）、配慮・方針・解釈、因果の推定。',
    '- 1文に客観と主観が混在する場合は**文内で区切って**該当部分をそれぞれに振り分ける（原文の語句単位で分割、語順は保持）。',
    '- 判断に迷う部分は**客観を優先**して objective に入れる。',
    '',
    '【行動観点フラグ（0/1）】',
    '本文（objective/subjective いずれでも可）に該当すれば 1、無ければ 0。重複検出でも 1。',
    tagLines,
    '',
    '【整形ルール】',
    '- 入力の改行・スペースを極力保持。JSONにおける改行は \\n として表現。先頭・末尾の不要な全角/半角スペースのみ除去可。',
    '- 意味の改変・要約・追記を禁止。',
    '',
    '【出力要件（厳守）】',
    '- 出力は **JSON配列** のみ（1要素）。例：[ { … } ]',
    '- すべてのキーは上記名を使用。フラグは数値 0/1。null/true/false は使用しない。',
    '- 末尾カンマ禁止。UTF-8、ダブルクォート使用。',
    '',
    '【出力スキーマ例】',
    '[',
    '  {',
    '    "objective": "（客観テキスト。改行は\\nで保持）",',
    '    "subjective": "（主観テキスト。無ければ空文字）",',
    ...tagSchemaLines,
    '  }',
    ']',
  ].join('\n');
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
    acc[tag.name] = numeric === 1 ? 1 : 0;
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
    const prompt = buildPrompt(text, tagList);
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GeminiのAPIキーが設定されていません' }, { status: 500 });
    }

    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash-exp',
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
        acc[tag.name] = text.includes(tag.name) ? 1 : 0;
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
