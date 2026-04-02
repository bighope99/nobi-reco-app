import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * GET /api/admin/companies/[companyId]
 * 会社詳細取得（site_adminのみ）
 */
export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ companyId: string }> }
) {
  try {
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // site_admin または company_admin のみアクセス可能
    if (metadata.role !== 'site_admin' && metadata.role !== 'company_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { companyId } = await props.params;

    // company_admin は自社のみアクセス可能
    if (metadata.role === 'company_admin' && metadata.company_id !== companyId) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const supabaseAdmin = await createAdminClient();

    // 会社情報を取得
    const { data: company, error: companyError } = await supabaseAdmin
      .from('m_companies')
      .select(`
        id,
        name,
        name_kana,
        postal_code,
        address,
        phone,
        email,
        is_active,
        created_at,
        updated_at
      `)
      .eq('id', companyId)
      .is('deleted_at', null)
      .single();

    if (companyError) {
      if (companyError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Company not found' },
          { status: 404 }
        );
      }
      throw companyError;
    }

    // 施設一覧とアカウント一覧を並列取得
    const [facilitiesResult, usersResult] = await Promise.all([
      // 施設一覧
      supabaseAdmin
        .from('m_facilities')
        .select(
          'id, name, name_kana, postal_code, address, phone, capacity, is_active'
        )
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name'),

      // アカウント一覧（company_admin + facility_admin + staff）
      supabaseAdmin
        .from('m_users')
        .select('id, name, name_kana, email, role, is_active, hire_date')
        .eq('company_id', companyId)
        .in('role', ['company_admin', 'facility_admin', 'staff'])
        .is('deleted_at', null)
        .order('role'),
    ]);

    // エラーハンドリング
    if (facilitiesResult.error) {
      console.error('Error fetching facilities:', facilitiesResult.error);
    }
    if (usersResult.error) {
      console.error('Error fetching accounts:', usersResult.error);
    }

    const userIds = (usersResult.data || []).map((u) => u.id);

    // _user_facilityを別クエリで取得（PostgRESTの埋め込みの代わり）
    const [emailConfirmedMap, userFacilitiesResult] = await Promise.all([
      (async () => {
        const map = new Map<string, boolean>();
        if (userIds.length > 0) {
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
            perPage: 1000,
          });
          (authUsers?.users || []).forEach((authUser) => {
            if (userIds.includes(authUser.id)) {
              map.set(authUser.id, !!authUser.email_confirmed_at);
            }
          });
        }
        return map;
      })(),
      userIds.length > 0
        ? supabaseAdmin
            .from('_user_facility')
            .select('user_id, facility_id, is_primary, is_current, m_facilities(id, name)')
            .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (userFacilitiesResult.error) {
      console.error('Error fetching user facilities:', userFacilitiesResult.error);
    }

    // ユーザーごとの施設リストを構築
    const facilityMap = new Map<string, Array<{ facility_id: string; facility_name: string; is_primary: boolean; is_current: boolean }>>();
    (userFacilitiesResult.data || []).forEach((uf) => {
      const mFacilities = Array.isArray(uf.m_facilities) ? uf.m_facilities[0] : uf.m_facilities as { name?: string } | null;
      if (!facilityMap.has(uf.user_id)) facilityMap.set(uf.user_id, []);
      facilityMap.get(uf.user_id)!.push({
        facility_id: uf.facility_id,
        facility_name: (mFacilities as { name?: string } | null)?.name || '',
        is_primary: uf.is_primary,
        is_current: uf.is_current,
      });
    });

    // アカウントデータを整形
    const accounts = (usersResult.data || []).map((user) => ({
      id: user.id,
      name: user.name,
      name_kana: user.name_kana,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      hire_date: user.hire_date ?? null,
      email_confirmed: user.email ? (emailConfirmedMap.get(user.id) ?? false) : false,
      facilities: facilityMap.get(user.id) || [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        company: {
          id: company.id,
          name: company.name,
          name_kana: company.name_kana || '',
          postal_code: company.postal_code || '',
          address: company.address || '',
          phone: company.phone || '',
          email: company.email || '',
          is_active: company.is_active,
          created_at: company.created_at,
          updated_at: company.updated_at,
        },
        facilities: facilitiesResult.data || [],
        accounts,
      },
    });
  } catch (error) {
    console.error('Error fetching company:', error);
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
 * PUT /api/admin/companies/[companyId]
 * 会社情報更新（site_adminのみ）
 */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ companyId: string }> }
) {
  try {
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // site_admin権限チェック
    if (metadata.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { companyId } = await props.params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // 必須パラメータチェック
    if (!body.company?.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: company.name is required',
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 会社の存在確認
    const { data: existingCompany, error: checkError } = await supabase
      .from('m_companies')
      .select('id')
      .eq('id', companyId)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingCompany) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // 会社情報を更新
    const { data: updatedCompany, error: updateError } = await supabase
      .from('m_companies')
      .update({
        name: body.company.name,
        name_kana: body.company.name_kana || null,
        postal_code: body.company.postal_code || null,
        address: body.company.address || null,
        phone: body.company.phone || null,
        email: body.company.email || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: {
        company: {
          id: updatedCompany.id,
          name: updatedCompany.name,
          name_kana: updatedCompany.name_kana || '',
          postal_code: updatedCompany.postal_code || '',
          address: updatedCompany.address || '',
          phone: updatedCompany.phone || '',
          email: updatedCompany.email || '',
        },
      },
      message: '会社情報を更新しました',
    });
  } catch (error) {
    console.error('Error updating company:', error);
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
