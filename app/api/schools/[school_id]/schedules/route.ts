import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/schools/:school_id/schedules
 * スケジュール追加
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { school_id: string } }
) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ユーザー情報取得
    const { data: userData } = await supabase
      .from('m_users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 権限チェック（staffは作成不可）
    if (userData.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { school_id } = params;

    // 学校の存在確認と権限チェック
    const { data: school, error: schoolError } = await supabase
      .from('m_schools')
      .select('id, facility_id')
      .eq('id', school_id)
      .is('deleted_at', null)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { success: false, error: 'School not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック
    if (
      userData.role === 'facility_admin' ||
      userData.role === 'staff'
    ) {
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_current', true);

      const facilityIds = userFacilities?.map((uf) => uf.facility_id) || [];
      if (!facilityIds.includes(school.facility_id)) {
        return NextResponse.json(
          { success: false, error: 'School not found' },
          { status: 404 }
        );
      }
    }

    const body = await request.json();

    // バリデーション
    if (!body.grades || !Array.isArray(body.grades) || body.grades.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Grades array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!body.weekday_times) {
      return NextResponse.json(
        { success: false, error: 'Weekday times are required' },
        { status: 400 }
      );
    }

    // スケジュール作成
    const { data: newSchedule, error: createError } = await supabase
      .from('s_school_schedules')
      .insert({
        school_id: school_id,
        grades: body.grades,
        monday_time: body.weekday_times.monday || null,
        tuesday_time: body.weekday_times.tuesday || null,
        wednesday_time: body.weekday_times.wednesday || null,
        thursday_time: body.weekday_times.thursday || null,
        friday_time: body.weekday_times.friday || null,
        saturday_time: body.weekday_times.saturday || null,
        sunday_time: body.weekday_times.sunday || null,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return NextResponse.json({
      success: true,
      data: {
        schedule_id: newSchedule.id,
        school_id: newSchedule.school_id,
        grades: newSchedule.grades,
        weekday_times: {
          monday: newSchedule.monday_time,
          tuesday: newSchedule.tuesday_time,
          wednesday: newSchedule.wednesday_time,
          thursday: newSchedule.thursday_time,
          friday: newSchedule.friday_time,
          saturday: newSchedule.saturday_time,
          sunday: newSchedule.sunday_time,
        },
        created_at: newSchedule.created_at,
      },
      message: 'スケジュールを追加しました',
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
