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

    const { role, company_id, current_facility_id } = metadata;

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

    // company_adminとfacility_admin/staffでは対象company_idが異なる
    // company_adminは自社のcompany_idを使い、facility_admin/staffは施設経由で取得
    let targetCompanyId: string;

    if (role === 'site_admin' || role === 'company_admin') {
      // site_admin/company_adminは自分のcompany_idを使用
      targetCompanyId = company_id;
    } else {
      // facility_admin/staffは施設からcompany_idを解決
      const { data: facility, error: facilityError } = await supabase
        .from('m_facilities')
        .select('company_id')
        .eq('id', targetFacilityId)
        .single();

      if (facilityError || !facility) {
        return NextResponse.json(
          { success: false, error: 'Facility not found' },
          { status: 404 }
        );
      }
      targetCompanyId = facility.company_id;
    }

    // 学校と施設紐付けを取得（対象施設に紐付いている学校のみ）
    const { data: schools, error: schoolsError } = await supabase
      .from('m_schools')
      .select(`
        id,
        name,
        name_kana,
        address,
        phone,
        is_active,
        created_at,
        updated_at,
        _school_facility!inner(facility_id, late_threshold_minutes)
      `)
      .eq('company_id', targetCompanyId)
      .eq('_school_facility.facility_id', targetFacilityId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (schoolsError) {
      throw schoolsError;
    }

    type SchoolFacilityRow = { facility_id: string; late_threshold_minutes: number };
    type SchoolRow = {
      id: string;
      name: string;
      name_kana: string | null;
      address: string | null;
      phone: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      _school_facility: SchoolFacilityRow | SchoolFacilityRow[];
    };

    // 各学校のスケジュールを取得
    const schoolsWithSchedules = await Promise.all(
      (schools as unknown as SchoolRow[] || []).map(async (school) => {
        const { data: schedules } = await supabase
          .from('s_school_schedules')
          .select('*')
          .eq('school_id', school.id)
          .is('deleted_at', null)
          .order('grades', { ascending: true });

        // _school_facilityのlate_threshold_minutesを使用（対象施設の設定）
        const schoolFacility = Array.isArray(school._school_facility)
          ? school._school_facility[0]
          : school._school_facility;
        const lateThresholdMinutes = schoolFacility?.late_threshold_minutes ?? 30;

        return {
          school_id: school.id,
          name: school.name,
          address: school.address,
          phone: school.phone,
          late_threshold_minutes: lateThresholdMinutes,
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

    const { role, company_id, current_facility_id } = metadata;

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

    // company_adminとfacility_adminでは対象company_idが異なる
    let targetCompanyId: string;

    if (role === 'site_admin' || role === 'company_admin') {
      targetCompanyId = company_id;
    } else {
      // facility_adminは施設からcompany_idを解決
      const { data: facility, error: facilityError } = await supabase
        .from('m_facilities')
        .select('company_id')
        .eq('id', current_facility_id)
        .single();

      if (facilityError || !facility) {
        return NextResponse.json(
          { success: false, error: 'Facility not found' },
          { status: 404 }
        );
      }
      targetCompanyId = facility.company_id;
    }

    // 学校作成
    const { data: newSchool, error: createError } = await supabase
      .from('m_schools')
      .insert({
        company_id: targetCompanyId,
        name: body.name,
        name_kana: body.name_kana || null,
        postal_code: body.postal_code || null,
        address: body.address || null,
        phone: body.phone || null,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // 中間テーブルに追加（作成者の施設に紐付け）
    const { error: linkError } = await supabase
      .from('_school_facility')
      .insert({
        school_id: newSchool.id,
        facility_id: current_facility_id,
        late_threshold_minutes: body.late_threshold_minutes ?? 30,
      });

    if (linkError) {
      // 中間テーブルの追加に失敗した場合は学校も削除してロールバック
      await supabase
        .from('m_schools')
        .delete()
        .eq('id', newSchool.id);
      throw linkError;
    }

    return NextResponse.json({
      success: true,
      data: {
        school_id: newSchool.id,
        name: newSchool.name,
        address: newSchool.address,
        phone: newSchool.phone,
        late_threshold_minutes: body.late_threshold_minutes ?? 30,
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

/**
 * PATCH /api/schools
 * 学校の late_threshold_minutes を更新（施設単位）
 */
export async function PATCH(request: NextRequest) {
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

    const { role, current_facility_id, company_id } = metadata;

    // 権限チェック（staffは更新不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 必須パラメータチェック
    if (!body.school_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: school_id' },
        { status: 400 }
      );
    }

    if (body.late_threshold_minutes === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: late_threshold_minutes' },
        { status: 400 }
      );
    }

    // バリデーション: 整数、0-120
    const threshold = Number(body.late_threshold_minutes);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 120) {
      return NextResponse.json(
        { success: false, error: 'late_threshold_minutes must be an integer between 0 and 120' },
        { status: 400 }
      );
    }

    // 施設IDの決定（パラメータがある場合はそちらを優先、site_admin/company_admin向け）
    const targetFacilityId = body.facility_id || current_facility_id;

    if (!targetFacilityId) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
      );
    }

    // 施設アクセス権限チェック（facility_adminは自施設のみ）
    if (role === 'facility_admin' && targetFacilityId !== current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // company_adminの場合、指定施設が自社のものかを確認
    if (role === 'company_admin' && targetFacilityId !== current_facility_id) {
      const { data: facilityCheck } = await supabase
        .from('m_facilities')
        .select('company_id')
        .eq('id', targetFacilityId)
        .is('deleted_at', null)
        .single();

      if (!facilityCheck || facilityCheck.company_id !== company_id) {
        return NextResponse.json(
          { success: false, error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // _school_facilityの存在確認
    const { data: schoolFacility, error: sfError } = await supabase
      .from('_school_facility')
      .select('id')
      .eq('school_id', body.school_id)
      .eq('facility_id', targetFacilityId)
      .is('deleted_at', null)
      .single();

    if (sfError || !schoolFacility) {
      return NextResponse.json(
        { success: false, error: 'School not found for this facility' },
        { status: 404 }
      );
    }

    // _school_facility を更新
    const { data: updatedSF, error: updateError } = await supabase
      .from('_school_facility')
      .update({
        late_threshold_minutes: threshold,
        updated_at: new Date().toISOString(),
      })
      .eq('school_id', body.school_id)
      .eq('facility_id', targetFacilityId)
      .select('school_id, late_threshold_minutes, updated_at')
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        school_id: updatedSF.school_id,
        late_threshold_minutes: updatedSF.late_threshold_minutes,
        updated_at: updatedSF.updated_at,
      },
      message: '遅刻閾値を更新しました',
    });
  } catch (error) {
    console.error('Error updating school late threshold:', error);
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
