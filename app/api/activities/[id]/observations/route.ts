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
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userSession = await getUserSession(session.user.id);
    if (!userSession?.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found in session' },
        { status: 400 },
      );
    }

    const { id } = await params;

    const { data: activity, error: activityError } = await supabase
      .from('r_activity')
      .select('id, facility_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { success: false, error: '活動記録が見つかりませんでした' },
        { status: 404 },
      );
    }

    if (activity.facility_id !== userSession.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'この活動記録にアクセスする権限がありません' },
        { status: 403 },
      );
    }

    const { data: observations, error: observationsError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        child_id,
        observation_date,
        content,
        created_at,
        m_children!inner (
          family_name,
          given_name,
          nickname
        )
      `,
      )
      .eq('activity_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (observationsError) {
      console.error('Observations fetch error:', observationsError);
      return NextResponse.json(
        { success: false, error: '個別記録の取得に失敗しました' },
        { status: 500 },
      );
    }

    const formatted = (observations || []).map((observation: any) => {
      const child = Array.isArray(observation.m_children)
        ? observation.m_children[0]
        : observation.m_children;
      const childName =
        child?.nickname || [child?.family_name, child?.given_name].filter(Boolean).join(' ') || '';

      return {
        observation_id: observation.id,
        child_id: observation.child_id,
        child_name: childName,
        observation_date: observation.observation_date,
        content: observation.content,
        created_at: observation.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        observations: formatted,
      },
    });
  } catch (error) {
    console.error('Activity observations API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
