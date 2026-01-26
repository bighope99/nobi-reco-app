import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { activity_id, child_id, observation_date, content } = body;

    if (!activity_id || typeof activity_id !== 'string') {
      return NextResponse.json(
        { error: 'activity_id is required and must be a string' },
        { status: 400 },
      );
    }

    if (!child_id || typeof child_id !== 'string') {
      return NextResponse.json(
        { error: 'child_id is required and must be a string' },
        { status: 400 },
      );
    }

    if (!observation_date || typeof observation_date !== 'string') {
      return NextResponse.json(
        { error: 'observation_date is required and must be a string (YYYY-MM-DD)' },
        { status: 400 },
      );
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json(
        { error: 'content is required and must be a non-empty string' },
        { status: 400 },
      );
    }

    const { data: activity, error: activityError } = await supabase
      .from('r_activity')
      .select('id, facility_id')
      .eq('id', activity_id)
      .is('deleted_at', null)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: '活動記録が見つかりませんでした' },
        { status: 404 },
      );
    }

    if (activity.facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'この活動記録に個別記録を追加する権限がありません' },
        { status: 403 },
      );
    }

    const { data: observation, error: observationError } = await supabase
      .from('r_observation')
      .insert({
        child_id,
        activity_id,
        observation_date,
        content,
        created_by: session.user_id,
      })
      .select()
      .single();

    if (observationError) {
      console.error('Failed to save observation:', observationError);
      return NextResponse.json(
        { error: observationError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: observation,
      message: '個別記録を保存しました',
    });
  } catch (error) {
    console.error('Observation save API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { observation_id } = body;

    if (!observation_id || typeof observation_id !== 'string') {
      return NextResponse.json(
        { error: 'observation_id is required and must be a string' },
        { status: 400 },
      );
    }

    const { data: observation, error: fetchError } = await supabase
      .from('r_observation')
      .select('id, activity_id, child_id')
      .eq('id', observation_id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !observation) {
      return NextResponse.json(
        { error: '個別記録が見つかりませんでした' },
        { status: 404 },
      );
    }

    let facilityId: string | null = null;
    if (observation.activity_id) {
      const { data: activity, error: activityError } = await supabase
        .from('r_activity')
        .select('facility_id')
        .eq('id', observation.activity_id)
        .is('deleted_at', null)
        .single();

      if (activityError) {
        console.error('Failed to fetch activity facility_id:', activityError);
        return NextResponse.json(
          { success: false, error: 'この個別記録の所属施設を確認できませんでした' },
          { status: 400 },
        );
      }

      facilityId = activity?.facility_id ?? null;
    }

    if (!facilityId && observation.child_id) {
      const { data: child, error: childError } = await supabase
        .from('m_children')
        .select('facility_id')
        .eq('id', observation.child_id)
        .is('deleted_at', null)
        .single();

      if (childError) {
        console.error('Failed to fetch child facility_id:', childError);
        return NextResponse.json(
          { success: false, error: 'この個別記録の所属施設を確認できませんでした' },
          { status: 400 },
        );
      }

      facilityId = child?.facility_id ?? null;
    }

    // SECURITY: Explicit null check before authorization to prevent IDOR vulnerability
    if (!facilityId) {
      console.error('Observation facility lookup failed: facilityId is null', {
        observation_id,
        activity_id: observation.activity_id,
        child_id: observation.child_id,
      });
      return NextResponse.json(
        { success: false, error: 'この個別記録の所属施設を確認できませんでした' },
        { status: 400 },
      );
    }

    if (facilityId !== session.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'この個別記録を削除する権限がありません' },
        { status: 403 },
      );
    }

    const deletedAt = new Date().toISOString();
    const { error: deleteError } = await supabase
      .from('r_observation')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .eq('id', observation_id);

    if (deleteError) {
      console.error('Failed to delete observation:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      observation_id,
      message: '個別記録を削除しました',
    });
  } catch (error) {
    console.error('Observation delete API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
