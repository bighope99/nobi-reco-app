import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { normalizeSearch } from '@/lib/utils/kana';

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

    const { data: facilities, error: facilitiesError } = await query.order(
      'name',
      { ascending: true }
    );

    if (facilitiesError) {
      throw facilitiesError;
    }

    // 施設IDリストを取得して統計情報を一括取得（N+1クエリ解消）
    const facilityIds = (facilities || []).map((f) => f.id);

    const [classRowsResult, childrenRowsResult, staffRowsResult] =
      await Promise.all([
        // クラス数: 一括取得
        supabase
          .from('m_classes')
          .select('facility_id')
          .in('facility_id', facilityIds)
          .is('deleted_at', null),
        // 児童数: 一括取得（在籍中のみ）
        supabase
          .from('m_children')
          .select('facility_id')
          .in('facility_id', facilityIds)
          .eq('enrollment_status', 'enrolled')
          .is('deleted_at', null),
        // 職員数: 一括取得（現職のみ）
        supabase
          .from('_user_facility')
          .select('facility_id')
          .in('facility_id', facilityIds)
          .eq('is_current', true),
      ]);

    const countByFacilityId = (
      rows: { facility_id: string }[] | null
    ): Record<string, number> =>
      (rows || []).reduce(
        (acc, row) => {
          acc[row.facility_id] = (acc[row.facility_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const classCountMap = countByFacilityId(classRowsResult.data);
    const childrenCountMap = countByFacilityId(childrenRowsResult.data);
    const staffCountMap = countByFacilityId(staffRowsResult.data);

    const facilitiesWithStats = (facilities || []).map((facility) => ({
      facility_id: facility.id,
      name: facility.name,
      address: facility.address,
      phone: facility.phone,
      email: facility.email,
      class_count: classCountMap[facility.id] || 0,
      children_count: childrenCountMap[facility.id] || 0,
      staff_count: staffCountMap[facility.id] || 0,
      created_at: facility.created_at,
      updated_at: facility.updated_at,
    }));

    // 検索フィルタ（ひらがな/カタカナ表記ゆれ・全角半角スペース対応）
    let filteredFacilities = facilitiesWithStats;
    if (search) {
      const normalizedSearch = normalizeSearch(search);
      filteredFacilities = facilitiesWithStats.filter(
        (f) =>
          normalizeSearch(f.name).includes(normalizedSearch) ||
          normalizeSearch(f.address || '').includes(normalizedSearch)
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        facilities: filteredFacilities,
        total: filteredFacilities.length,
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
