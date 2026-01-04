import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function GET(
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

    const { data, error: fetchError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        child_id,
        observation_date,
        content,
        objective,
        subjective,
        created_by,
        created_at,
        updated_at,
        m_children!inner (
          facility_id,
          family_name,
          given_name,
          nickname
        ),
        record_tags:_record_tag!observation_id (
          tag_id
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { success: false, error: fetchError?.message || 'データが見つかりませんでした' },
        { status: 404 },
      );
    }

    // m_children は配列の可能性があるため、単一オブジェクトとして取得
    const child = Array.isArray(data.m_children) ? data.m_children[0] : data.m_children;

    if (!child || child.facility_id !== session.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const childName =
      child.nickname ||
      [child.family_name, child.given_name].filter(Boolean).join(' ') ||
      '';
    const tagFlags = (data.record_tags || []).reduce<Record<string, boolean>>((acc, item) => {
      if (item?.tag_id) {
        acc[item.tag_id] = true;
      }
      return acc;
    }, {});
    const { data: createdByUser } = await supabase
      .from('m_users')
      .select('name')
      .eq('id', data.created_by)
      .single();
    const createdByName = createdByUser?.name || '';

    const { data: recentObservations, error: recentError } = await supabase
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
      .eq('child_id', data.child_id)
      .is('deleted_at', null)
      .neq('id', data.id)
      .order('observation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Recent observations load error:', recentError);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        child_id: data.child_id,
        child_name: childName,
        observation_date: data.observation_date,
        content: data.content,
        objective: data.objective ?? '',
        subjective: data.subjective ?? '',
        tag_flags: tagFlags,
        created_by: data.created_by,
        created_by_name: createdByName,
        created_at: data.created_at,
        updated_at: data.updated_at,
        recent_observations: (recentObservations || []).map((obs) => ({
          id: obs.id,
          observation_date: obs.observation_date,
          content: obs.content,
          created_at: obs.created_at,
          tag_ids: (obs.record_tags || [])
            .map((tag: { tag_id?: string }) => tag.tag_id)
            .filter(Boolean),
        })),
      },
    });
  } catch (error) {
    console.error('Observation detail API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
