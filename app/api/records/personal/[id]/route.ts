import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params;
    if (!id) {
      return NextResponse.json(
        { error: 'observation_id is required' },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await getUserSession(user.id);
    if (!session || !session.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error: fetchError } = await supabase
      .from('r_observation')
      .select(
        `
        id,
        child_id,
        observation_date,
        content,
        created_by,
        created_at,
        updated_at,
        m_users (
          name
        ),
        m_children (
          family_name,
          given_name,
          nickname,
          facility_id
        )
      `,
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !data) {
      return NextResponse.json(
        { error: '観察記録が見つかりませんでした' },
        { status: 404 },
      );
    }

    if (data.m_children?.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'この観察記録を閲覧する権限がありません' },
        { status: 403 },
      );
    }

    const childName =
      data.m_children?.nickname ||
      [data.m_children?.family_name, data.m_children?.given_name]
        .filter(Boolean)
        .join(' ') ||
      '';

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        child_id: data.child_id,
        child_name: childName,
        observation_date: data.observation_date,
        content: data.content,
        created_by: data.m_users?.name || data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    });
  } catch (error) {
    console.error('Observation detail API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
