import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const body = await request.json();
    const objective = typeof body?.ai_action === 'string' ? body.ai_action.trim() : '';
    const subjective = typeof body?.ai_opinion === 'string' ? body.ai_opinion.trim() : '';

    const { data: existing, error: fetchError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        m_children!inner (
          facility_id
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: fetchError?.message || 'データが見つかりませんでした' },
        { status: 404 },
      );
    }

    const child = Array.isArray(existing.m_children) ? existing.m_children[0] : existing.m_children;
    if (!child || child.facility_id !== session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const tagFlags = Object.entries(body || {}).reduce<Record<string, number>>((acc, [key, value]) => {
      if (key === 'ai_action' || key === 'ai_opinion') {
        return acc;
      }
      const numeric = value === true || value === 1 ? 1 : 0;
      if (numeric === 1) {
        acc[key] = 1;
      }
      return acc;
    }, {});

    const hasAiResult = Boolean(objective || subjective || Object.keys(tagFlags).length > 0);

    const { error: updateError } = await supabase
      .from('r_observation')
      .update({
        objective: objective || null,
        subjective: subjective || null,
        is_ai_analyzed: hasAiResult,
        ai_analyzed_at: hasAiResult ? new Date().toISOString() : null,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Observation AI update error:', updateError);
      return NextResponse.json({ success: false, error: 'AI解析結果の保存に失敗しました' }, { status: 500 });
    }

    const { error: deleteError } = await supabase
      .from('_record_tag')
      .delete()
      .eq('observation_id', id);

    if (deleteError) {
      console.error('Observation tag delete error:', deleteError);
      return NextResponse.json({ success: false, error: 'AI解析結果の保存に失敗しました' }, { status: 500 });
    }

    const tagInserts = Object.keys(tagFlags).map((tagId) => ({
      observation_id: id,
      tag_id: tagId,
      is_auto_tagged: true,
      confidence_score: null,
    }));

    if (tagInserts.length > 0) {
      const { error: insertError } = await supabase.from('_record_tag').insert(tagInserts);
      if (insertError) {
        console.error('Observation tag insert error:', insertError);
        return NextResponse.json({ success: false, error: 'AI解析結果の保存に失敗しました' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        objective,
        subjective,
        tag_flags: tagFlags,
      },
    });
  } catch (error) {
    console.error('Observation AI API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
