import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { validateDailySchedule, validateEventName } from '@/lib/validation/activityValidation';

/**
 * 活動記録テンプレート一覧取得
 * GET /api/activity-templates
 */
export async function GET() {
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

    const { data: templates, error } = await supabase
      .from('s_activity_templates')
      .select('id, name, event_name, daily_schedule, created_by, created_at')
      .eq('facility_id', session.current_facility_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('activity-templates GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, templates: templates ?? [] });
  } catch (error) {
    console.error('activity-templates GET unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 活動記録テンプレート新規作成
 * POST /api/activity-templates
 */
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
    const { name, event_name, daily_schedule, facility_id } = body;

    // テンプレート名バリデーション
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'name is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    if (name.length > 100) {
      return NextResponse.json(
        { error: 'name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // facility_id 一致確認
    if (facility_id && facility_id !== session.current_facility_id) {
      return NextResponse.json(
        { error: 'facility_id does not match current facility' },
        { status: 403 }
      );
    }

    // event_name バリデーション
    const eventNameResult = validateEventName(event_name);
    if (!eventNameResult.valid) {
      return NextResponse.json({ error: eventNameResult.error }, { status: 400 });
    }

    // daily_schedule バリデーション
    const dailyScheduleResult = validateDailySchedule(daily_schedule);
    if (!dailyScheduleResult.valid) {
      return NextResponse.json({ error: dailyScheduleResult.error }, { status: 400 });
    }

    const { data: template, error } = await supabase
      .from('s_activity_templates')
      .insert({
        facility_id: session.current_facility_id,
        name: name.trim(),
        event_name: eventNameResult.data,
        daily_schedule: dailyScheduleResult.data,
        created_by: session.user_id,
      })
      .select()
      .single();

    if (error) {
      console.error('activity-templates POST error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    console.error('activity-templates POST unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
