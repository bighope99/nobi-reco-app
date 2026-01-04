import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

/**
 * 新規観察記録を作成するAPIエンドポイント
 * POST /api/records/personal
 */
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
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { child_id, observation_date, content, ai_action, ai_opinion, tag_flags } = body;
    const objective = typeof ai_action === 'string' ? ai_action.trim() : '';
    const subjective = typeof ai_opinion === 'string' ? ai_opinion.trim() : '';
    const hasAiResult = Boolean(objective || subjective);

    // バリデーション
    if (!child_id || !observation_date || !content) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています (child_id, observation_date, content)' },
        { status: 400 },
      );
    }

    // 子どもが現在の施設に所属しているか確認
    const { data: childData, error: childError } = await supabase
      .from('m_children')
      .select('facility_id')
      .eq('id', child_id)
      .is('deleted_at', null)
      .single();

    if (childError || !childData) {
      return NextResponse.json({ success: false, error: '子どもが見つかりません' }, { status: 404 });
    }

    if (childData.facility_id !== session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'この子どもの記録を作成する権限がありません' }, { status: 403 });
    }

    // 観察記録を作成
    const { data: observationData, error: insertError } = await supabase
      .from('r_observation')
      .insert({
        child_id,
        observation_date,
        content,
        objective: objective || null,
        subjective: subjective || null,
        is_ai_analyzed: hasAiResult,
        ai_analyzed_at: hasAiResult ? new Date().toISOString() : null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (insertError || !observationData) {
      console.error('Observation insert error:', insertError);
      return NextResponse.json({ success: false, error: '観察記録の作成に失敗しました' }, { status: 500 });
    }

    const observationId = observationData.id;

    // AI解析結果（タグ）を保存
    if (tag_flags && typeof tag_flags === 'object') {
      const tagInserts = Object.entries(tag_flags)
        .filter(([_, value]) => value === true || value === 1)
        .map(([tagId]) => ({
          observation_id: observationId,
          tag_id: tagId,
          is_auto_tagged: true,
          confidence_score: null,
        }));

      if (tagInserts.length > 0) {
        const { error: tagError } = await supabase.from('_record_tag').insert(tagInserts);

        if (tagError) {
          console.error('Tag insert error:', tagError);
          // タグ挿入エラーは致命的でないため、警告のみ
        }
      }
    }

    // TODO: ai_actionとai_opinionをどこに保存するか検討
    // 現在のDBスキーマではr_observationテーブルにAI解析結果のカラムがないため、
    // 将来的には専用のテーブルを作成するか、r_observationにカラムを追加する必要がある

    return NextResponse.json({
      success: true,
      data: {
        id: observationId,
        child_id,
        observation_date,
        content,
      },
    });
  } catch (error) {
    console.error('Observation create API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
