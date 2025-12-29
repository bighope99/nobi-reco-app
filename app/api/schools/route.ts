import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * GET /api/schools
 * 学校一覧とスケジュール取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // JWTメタデータから認証情報を取得
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role, current_facility_id } = metadata;

    // リクエストパラメータ取得
    const searchParams = request.nextUrl.searchParams;
    const facilityId = searchParams.get('facility_id');

    // 施設IDの決定（パラメータがない場合はJWTから取得）
    const targetFacilityId = facilityId || current_facility_id;

    if (!targetFacilityId) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
      );
    }

    // 権限チェック（facility_adminとstaffは自施設のみ）
    if (
      (role === 'facility_admin' || role === 'staff') &&
      targetFacilityId !== current_facility_id
    ) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 学校一覧取得
    const { data: schools, error: schoolsError } = await supabase
      .from('m_schools')
      .select('id, name, address, phone, created_at, updated_at')
      .eq('facility_id', targetFacilityId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (schoolsError) {
      throw schoolsError;
    }

    // 各学校のスケジュールを取得
    const schoolsWithSchedules = await Promise.all(
      (schools || []).map(async (school) => {
        const { data: schedules } = await supabase
          .from('s_school_schedules')
          .select('*')
          .eq('school_id', school.id)
          .is('deleted_at', null)
          .order('grades', { ascending: true });

        return {
          school_id: school.id,
          name: school.name,
          address: school.address,
          phone: school.phone,
          schedules: (schedules || []).map((s) => ({
            schedule_id: s.id,
            grades: s.grades || [],
            weekday_times: {
              monday: s.monday_time,
              tuesday: s.tuesday_time,
              wednesday: s.wednesday_time,
              thursday: s.thursday_time,
              friday: s.friday_time,
              saturday: s.saturday_time,
              sunday: s.sunday_time,
            },
            created_at: s.created_at,
            updated_at: s.updated_at,
          })),
          created_at: school.created_at,
          updated_at: school.updated_at,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        schools: schoolsWithSchedules,
        total: schoolsWithSchedules.length,
      },
    });
  } catch (error) {
    console.error('Error fetching schools:', error);
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

/**
 * POST /api/schools
 * 学校登録
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // JWTメタデータから認証情報を取得
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { role, current_facility_id } = metadata;

    // 権限チェック（staffは作成不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    if (!current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 必須パラメータチェック
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: name' },
        { status: 400 }
      );
    }

    // 学校作成
    const { data: newSchool, error: createError } = await supabase
      .from('m_schools')
      .insert({
        facility_id: current_facility_id,
        name: body.name,
        address: body.address || null,
        phone: body.phone || null,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return NextResponse.json({
      success: true,
      data: {
        school_id: newSchool.id,
        name: newSchool.name,
        address: newSchool.address,
        phone: newSchool.phone,
        schedules: [],
        created_at: newSchool.created_at,
      },
      message: '学校を登録しました',
    });
  } catch (error) {
    console.error('Error creating school:', error);
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
