import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * GET /api/facilities
 * 施設一覧取得
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

    const { company_id } = metadata;

    // 検索パラメータ取得
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    // 施設一覧取得クエリ
    let query = supabase
      .from('m_facilities')
      .select(
        `
        id,
        name,
        address,
        phone,
        email,
        created_at,
        updated_at,
        company_id
      `
      )
      .is('deleted_at', null);

    // 自分が所属している会社の全施設を取得（設定ページでは権限によるフィルタリングは後ほど実装）
    query = query.eq('company_id', company_id);

    // 検索フィルタ
    if (search) {
      query = query.or(`name.ilike.%${search}%,address.ilike.%${search}%`);
    }

    const { data: facilities, error: facilitiesError } = await query.order(
      'name',
      { ascending: true }
    );

    if (facilitiesError) {
      throw facilitiesError;
    }

    // 各施設の統計情報を取得
    const facilitiesWithStats = await Promise.all(
      (facilities || []).map(async (facility) => {
        // クラス数
        const { count: classCount } = await supabase
          .from('m_classes')
          .select('*', { count: 'exact', head: true })
          .eq('facility_id', facility.id)
          .is('deleted_at', null);

        // 児童数
        const { count: childrenCount } = await supabase
          .from('m_children')
          .select('*', { count: 'exact', head: true })
          .eq('facility_id', facility.id)
          .eq('enrollment_status', 'enrolled')
          .is('deleted_at', null);

        // 職員数
        const { count: staffCount } = await supabase
          .from('_user_facility')
          .select('*', { count: 'exact', head: true })
          .eq('facility_id', facility.id)
          .eq('is_current', true);

        return {
          facility_id: facility.id,
          name: facility.name,
          address: facility.address,
          phone: facility.phone,
          email: facility.email,
          class_count: classCount || 0,
          children_count: childrenCount || 0,
          staff_count: staffCount || 0,
          created_at: facility.created_at,
          updated_at: facility.updated_at,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        facilities: facilitiesWithStats,
        total: facilitiesWithStats.length,
      },
    });
  } catch (error) {
    console.error('Error fetching facilities:', error);
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
 * POST /api/facilities
 * 施設新規作成
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

    const { role, company_id } = metadata;

    // 権限チェック（company_adminのみ作成可能）
    if (role !== 'company_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 必須パラメータチェック
    if (!body.name || !body.address || !body.phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 施設作成
    const { data: newFacility, error: createError } = await supabase
      .from('m_facilities')
      .insert({
        company_id: company_id,
        name: body.name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        postal_code: body.postal_code,
        capacity: body.capacity,
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
        facility_id: newFacility.id,
        name: newFacility.name,
        created_at: newFacility.created_at,
      },
      message: '施設を作成しました',
    });
  } catch (error) {
    console.error('Error creating facility:', error);
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
