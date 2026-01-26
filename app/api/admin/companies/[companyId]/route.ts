import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
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
