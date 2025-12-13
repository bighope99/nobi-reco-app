import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/facilities/:facility_id
 * 施設詳細情報取得
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ facility_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { facility_id: facilityId } = await params;

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

    // 施設情報取得
    const { data: facility, error: facilityError } = await supabase
      .from('m_facilities')
      .select(
        `
        id,
        company_id,
        name,
        address,
        postal_code,
        phone,
        email,
        created_at,
        updated_at,
        m_companies (
          id,
          name
        )
      `
      )
      .eq('id', facilityId)
      .is('deleted_at', null)
      .single();

    if (facilityError || !facility) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
      );
    }

    // アクセス権限チェック
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

    // 権限チェック
    if (
      userData.role !== 'site_admin' &&
      userData.role === 'company_admin' &&
      facility.company_id !== userData.company_id
    ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 404 }
      );
    }

    if (
      userData.role === 'facility_admin' ||
      userData.role === 'staff'
    ) {
      const { data: userFacility } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('facility_id', facilityId)
        .eq('is_current', true)
        .single();

      if (!userFacility) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 404 }
        );
      }
    }

    // 統計情報取得
    const { count: childrenCount } = await supabase
      .from('m_children')
      .select('*', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      .eq('enrollment_status', 'enrolled')
      .is('deleted_at', null);

    const { count: staffCount } = await supabase
      .from('_user_facility')
      .select('*', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      .eq('is_current', true);

    const { count: classesCount } = await supabase
      .from('m_classes')
      .select('*', { count: 'exact', head: true })
      .eq('facility_id', facilityId)
      .is('deleted_at', null);

    return NextResponse.json({
      success: true,
      data: {
        facility_id: facility.id,
        name: facility.name,
        address: facility.address,
        postal_code: facility.postal_code,
        phone: facility.phone,
        email: facility.email,
        company_id: facility.company_id,
        company_name: facility.m_companies?.name,
        current_children_count: childrenCount || 0,
        current_staff_count: staffCount || 0,
        current_classes_count: classesCount || 0,
        created_at: facility.created_at,
        updated_at: facility.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching facility:', error);
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
 * PUT /api/facilities/:facility_id
 * 施設情報更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ facility_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { facility_id: facilityId } = await params;

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

    // 施設情報取得（権限チェック用）
    const { data: facility } = await supabase
      .from('m_facilities')
      .select('company_id')
      .eq('id', facilityId)
      .is('deleted_at', null)
      .single();

    if (!facility) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
      );
    }

    // 権限チェック
    if (
      userData.role === 'company_admin' &&
      facility.company_id !== userData.company_id
    ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 404 }
      );
    }

    if (userData.role === 'facility_admin') {
      const { data: userFacility } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('facility_id', facilityId)
        .eq('is_current', true)
        .single();

      if (!userFacility) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 404 }
        );
      }
    }

    if (userData.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 施設情報更新
    const { data: updatedFacility, error: updateError } = await supabase
      .from('m_facilities')
      .update({
        name: body.name,
        address: body.address,
        postal_code: body.postal_code,
        phone: body.phone,
        email: body.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', facilityId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        facility_id: updatedFacility.id,
        name: updatedFacility.name,
        updated_at: updatedFacility.updated_at,
      },
      message: '施設情報を更新しました',
    });
  } catch (error) {
    console.error('Error updating facility:', error);
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
