import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptOrFallback } from '@/utils/crypto/decryption-helper';
import { calculateGrade } from '@/utils/grade';
import { formatObservationsToYaml } from '@/lib/ai/report/formatObservationsToYaml';
import { buildReportMessages } from '@/lib/ai/prompts/report';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// POST /api/records/report - AIレポート生成
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // リクエストボディのパース
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { child_id, from_date, to_date } = body as Record<string, unknown>;

    // 入力バリデーション
    if (typeof child_id !== 'string' || !UUID_REGEX.test(child_id)) {
      return NextResponse.json(
        { success: false, error: 'child_id must be a valid UUID' },
        { status: 400 },
      );
    }
    if (typeof from_date !== 'string' || !DATE_REGEX.test(from_date)) {
      return NextResponse.json(
        { success: false, error: 'from_date must be in YYYY-MM-DD format' },
        { status: 400 },
      );
    }
    if (typeof to_date !== 'string' || !DATE_REGEX.test(to_date)) {
      return NextResponse.json(
        { success: false, error: 'to_date must be in YYYY-MM-DD format' },
        { status: 400 },
      );
    }
    if (from_date > to_date) {
      return NextResponse.json(
        { success: false, error: 'from_date must be before or equal to to_date' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 児童情報の取得
    const { data: childData, error: childError } = await supabase
      .from('m_children')
      .select('id, family_name, given_name, birth_date, grade_add, facility_id')
      .eq('id', child_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (childError) {
      console.error('Child fetch error:', childError);
      return NextResponse.json({ success: false, error: 'Failed to fetch child' }, { status: 500 });
    }
    if (!childData) {
      return NextResponse.json({ success: false, error: 'Child not found' }, { status: 404 });
    }

    // 施設IDの照合（アクセス制御）
    if (
      metadata.current_facility_id &&
      childData.facility_id !== metadata.current_facility_id
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const familyName = decryptOrFallback(childData.family_name) ?? '';
    const givenName = decryptOrFallback(childData.given_name) ?? '';
    const childName = `${familyName} ${givenName}`.trim();

    // 観察記録の取得（最大200件）
    const { data: observations, error: observationsError } = await supabase
      .from('r_observation')
      .select('id, observation_date, content, objective, subjective')
      .eq('child_id', child_id)
      .gte('observation_date', from_date)
      .lte('observation_date', to_date)
      .is('deleted_at', null)
      .order('observation_date', { ascending: true })
      .limit(200);

    if (observationsError) {
      console.error('Observations fetch error:', observationsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch observations' },
        { status: 500 },
      );
    }

    const observationList = observations ?? [];

    // タグの取得
    type ObservationWithTags = {
      id: string;
      observation_date: string;
      content: string;
      objective: string | null;
      subjective: string | null;
      tags: Array<{ name: string }>;
    };

    type ObservationRow = {
      id: string;
      observation_date: string;
      content: string;
      objective: string | null;
      subjective: string | null;
    };

    let observationsWithTags: ObservationWithTags[] = (observationList as ObservationRow[]).map((obs) => ({
      ...obs,
      tags: [],
    }));

    if (observationList.length > 0) {
      const observationIds = (observationList as ObservationRow[]).map((obs) => obs.id);

      const { data: tagLinks, error: tagError } = await supabase
        .from('_record_tag')
        .select('observation_id, m_observation_tags(name)')
        .in('observation_id', observationIds);

      if (tagError) {
        console.error('Tags fetch error:', tagError);
        // タグ取得失敗は致命的でないため続行
      } else {
        // タグをobservation_idでグループ化
        // Supabaseのジョイン結果はオブジェクト or 配列どちらになる場合もあるため unknown 経由でキャスト
        type TagLink = {
          observation_id: string;
          m_observation_tags: { name: string } | Array<{ name: string }> | null;
        };
        const tagsByObsId = new Map<string, Array<{ name: string }>>();
        for (const link of (tagLinks ?? []) as unknown as TagLink[]) {
          const obsId = link.observation_id;
          const tagData = link.m_observation_tags;
          if (!tagsByObsId.has(obsId)) {
            tagsByObsId.set(obsId, []);
          }
          if (Array.isArray(tagData)) {
            for (const t of tagData) {
              if (t?.name) tagsByObsId.get(obsId)!.push({ name: t.name });
            }
          } else if (tagData?.name) {
            tagsByObsId.get(obsId)!.push({ name: tagData.name });
          }
        }

        observationsWithTags = observationList.map((obs: { id: string; observation_date: string; content: string; objective: string | null; subjective: string | null }) => ({
          ...obs,
          tags: tagsByObsId.get(obs.id) ?? [],
        }));
      }
    }

    // YAML生成
    const { yaml, truncated, observationCount } = formatObservationsToYaml({
      childName,
      grade: childData.birth_date
        ? calculateGrade(childData.birth_date, childData.grade_add ?? 0)
        : null,
      fromDate: from_date,
      toDate: to_date,
      observations: observationsWithTags,
    });

    // LangChain でレポート生成
    const dateRange = `${from_date} 〜 ${to_date}`;
    const { system, user } = buildReportMessages(childName, dateRange, yaml);

    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    const aiResponse = await model.invoke([
      new SystemMessage(system),
      new HumanMessage(user),
    ]);

    const report =
      typeof aiResponse.content === 'string'
        ? aiResponse.content
        : JSON.stringify(aiResponse.content);

    return NextResponse.json({
      success: true,
      data: {
        yaml,
        report,
        prompt_template: user,
        child_name: childName,
        observation_count: observationCount,
        truncated,
      },
    });
  } catch (error) {
    console.error('Report generation error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
