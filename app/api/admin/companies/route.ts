import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * GET /api/admin/companies
 * 会社一覧取得（管理画面用）
 * site_adminロールのみアクセス可能
 */
export async function GET() {
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

    // 権限チェック（site_adminのみアクセス可能）
    if (metadata.role !== 'site_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 会社一覧取得クエリ
    const { data: companies, error: companiesError } = await supabase
      .from('m_companies')
      .select(
        `
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
      `
      )
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (companiesError) {
      throw companiesError;
    }

    // 各会社の施設数をカウント
    const companiesWithCount = await Promise.all(
      (companies || []).map(async (company) => {
        const { count: facilitiesCount } = await supabase
          .from('m_facilities')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          .is('deleted_at', null);

        return {
          id: company.id,
          name: company.name,
          name_kana: company.name_kana,
          postal_code: company.postal_code,
          address: company.address,
          phone: company.phone,
          email: company.email,
          is_active: company.is_active,
          facilities_count: facilitiesCount || 0,
          created_at: company.created_at,
          updated_at: company.updated_at,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        companies: companiesWithCount,
      },
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
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
