import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
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

    const { childId } = await params;
    if (!childId) {
      return NextResponse.json({ success: false, error: 'childId is required' }, { status: 400 });
    }

    const { data: childData, error: childError } = await supabase
      .from('m_children')
      .select('facility_id')
      .eq('id', childId)
      .is('deleted_at', null)
      .single();

    if (childError || !childData) {
      return NextResponse.json({ success: false, error: '子どもが見つかりません' }, { status: 404 });
    }

    if (childData.facility_id !== session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: observations, error: obsError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        observation_date,
        content,
        created_at,
        record_tags:_record_tag!observation_id (
          tag_id
        )
      `,
      )
      .eq('child_id', childId)
      .is('deleted_at', null)
      .order('observation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (obsError) {
      console.error('Recent observations load error:', obsError);
      return NextResponse.json({ success: false, error: '過去記録の取得に失敗しました' }, { status: 500 });
    }

    const observationIds = (observations || []).map((obs) => obs.id).filter(Boolean);
    let tagMap: Record<string, string[]> = {};
    if (observationIds.length > 0) {
      const { data: tagRows, error: tagError } = await supabase
        .from('_record_tag')
        .select('observation_id, tag_id')
        .in('observation_id', observationIds);
      if (tagError) {
        console.error('Recent observation tags load error:', tagError);
      } else {
        tagMap = (tagRows || []).reduce<Record<string, string[]>>((acc, row) => {
          if (!row.observation_id || !row.tag_id) {
            return acc;
          }
          if (!acc[row.observation_id]) {
            acc[row.observation_id] = [];
          }
          acc[row.observation_id].push(row.tag_id);
          return acc;
        }, {});
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        recent_observations: (observations || []).map((obs) => ({
          id: obs.id,
          observation_date: obs.observation_date,
          content: obs.content,
          created_at: obs.created_at,
          tag_ids: (() => {
            const fromJoin = Array.isArray(obs.record_tags)
              ? obs.record_tags
                  .map((tag: { tag_id?: string }) => tag.tag_id)
                  .filter(Boolean)
              : [];
            if (fromJoin.length > 0) {
              return fromJoin;
            }
            return tagMap[obs.id] || [];
          })(),
        })),
      },
    });
  } catch (error) {
    console.error('Recent observation API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
