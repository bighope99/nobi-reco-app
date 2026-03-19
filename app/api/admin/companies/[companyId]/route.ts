import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

interface UserFacilityRelation {
  facility_id: string;
  is_primary: boolean;
  m_facilities: { name: string } | null;
}

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

    // site_admin権限チェック
    if (metadata.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { companyId } = await props.params;

    const supabase = await createClient();

    // 会社情報を取得
    const { data: company, error: companyError } = await supabase
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
    const [facilitiesResult, accountsResult] = await Promise.all([
      // 施設一覧
      supabase
        .from('m_facilities')
        .select(
          'id, name, name_kana, postal_code, address, phone, capacity, is_active'
        )
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name'),

      // アカウント一覧（company_admin + facility_admin）
      supabase
        .from('m_users')
        .select(
          `
          id, name, name_kana, email, role, is_active,
          _user_facility!_user_facility_user_id_fkey (
            facility_id, is_primary,
            m_facilities ( id, name )
          )
        `
        )
        .eq('company_id', companyId)
        .in('role', ['company_admin', 'facility_admin'])
        .is('deleted_at', null)
        .order('role'),
    ]);

    // エラーハンドリング
    if (facilitiesResult.error) {
      console.error('Error fetching facilities:', facilitiesResult.error);
    }
    if (accountsResult.error) {
      console.error('Error fetching accounts:', accountsResult.error);
    }

    // Auth ユーザーのメール確認状態を一括取得
    const supabaseAdmin = await createAdminClient();
    const userIds = (accountsResult.data || []).map((u) => u.id);
    const emailConfirmedMap = new Map<string, boolean>();
    if (userIds.length > 0) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      (authUsers?.users || []).forEach((authUser) => {
        if (userIds.includes(authUser.id)) {
          emailConfirmedMap.set(authUser.id, !!authUser.email_confirmed_at);
        }
      });
    }

    // アカウントデータを整形（_user_facilityをフラットに）
    const accounts = (accountsResult.data || []).map((user) => ({
      id: user.id,
      name: user.name,
      name_kana: user.name_kana,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      email_confirmed: emailConfirmedMap.get(user.id) ?? true,
      facilities: (user._user_facility || []).map((uf: UserFacilityRelation) => ({
        facility_id: uf.facility_id,
        facility_name: uf.m_facilities?.name || '',
        is_primary: uf.is_primary,
      })),
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
