import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';
import { getCurrentDateJST } from '@/lib/utils/timezone';

/**
 * GET /api/admin/companies
 * 会社一覧取得（site_adminのみ）
 */
export async function GET() {
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

    const supabase = await createClient();

    // 会社一覧と施設数を取得
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

    // 各会社の施設数と代表者情報を並列取得
    const companiesWithFacilityCount = await Promise.all(
      (companies || []).map(async (company) => {
        const [
          { count: facilityCount },
          { data: adminUser }
        ] = await Promise.all([
          supabase
            .from('m_facilities')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', company.id)
            .is('deleted_at', null),
          supabase
            .from('m_users')
            .select('id, name, email')
            .eq('company_id', company.id)
            .eq('role', 'company_admin')
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle()
        ]);

        return {
          ...company,
          facilities_count: facilityCount || 0,
          admin_user: adminUser ? {
            id: adminUser.id,
            name: adminUser.name,
            email: adminUser.email,
          } : null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        companies: companiesWithFacilityCount,
        total: companiesWithFacilityCount.length,
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

/**
 * POST /api/admin/companies
 * 会社 + 会社管理者ユーザー作成（site_adminのみ）
 * 施設は別途 /api/admin/companies/[companyId]/facilities で登録する
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // 必須パラメータチェック（施設は不要）
    if (!body.company?.name || !body.admin_user?.name || !body.admin_user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: company.name, admin_user.name, and admin_user.email are required'
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // メールアドレス重複チェック
    const { data: existingUser } = await supabase
      .from('m_users')
      .select('id')
      .eq('email', body.admin_user.email)
      .is('deleted_at', null)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Step 1: 会社作成
    const { data: newCompany, error: companyError } = await supabase
      .from('m_companies')
      .insert({
        name: body.company.name,
        name_kana: body.company.name_kana,
        postal_code: body.company.postal_code,
        address: body.company.address,
        phone: body.company.phone,
        email: body.company.email,
        is_active: true,
      })
      .select()
      .single();

    if (companyError) {
      throw companyError;
    }

    // Step 2: Supabase Auth ユーザー作成（current_facility_id は null: 施設はまだない）
    const supabaseAdmin = await createAdminClient();

    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: body.admin_user.email,
      email_confirm: false,
      app_metadata: {
        role: 'company_admin',
        company_id: newCompany.id,
        current_facility_id: null,
      },
    });

    if (authCreateError || !authData.user) {
      // ロールバック: 会社削除
      await supabase.from('m_companies').delete().eq('id', newCompany.id);
      throw authCreateError || new Error('Failed to create auth user');
    }

    // Step 3: 招待リンク生成
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: body.admin_user.email,
    });

    if (linkError || !linkData) {
      // ロールバック
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_companies').delete().eq('id', newCompany.id);
      throw linkError || new Error('Failed to generate invite link');
    }

    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    if (!tokenHash) {
      console.error('Failed to extract token from invite link for email:', body.admin_user.email);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_companies').delete().eq('id', newCompany.id);
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // Step 4: m_users テーブルにユーザー情報を登録
    const hireDateValue = body.admin_user.hire_date || getCurrentDateJST();

    const { data: newUser, error: createUserError } = await supabase
      .from('m_users')
      .insert({
        id: authData.user.id,
        company_id: newCompany.id,
        email: body.admin_user.email,
        name: body.admin_user.name,
        name_kana: body.admin_user.name_kana || null,
        role: 'company_admin',
        is_active: true,
        hire_date: hireDateValue,
        is_retired: false,
      })
      .select()
      .single();

    if (createUserError) {
      // ロールバック
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_companies').delete().eq('id', newCompany.id);
      throw createUserError;
    }

    // Step 5: 招待メール送信（fire-and-forget: レスポンスをブロックしない）
    const emailHtml = buildUserInvitationEmailHtml({
      userName: newUser.name,
      userEmail: newUser.email,
      role: newUser.role,
      companyName: newCompany.name,
      inviteUrl,
    });

    sendWithGas({
      to: newUser.email,
      subject: '【のびレコ】アカウント登録のご案内',
      htmlBody: emailHtml,
      senderName: 'のびレコ',
    }).catch((emailError) => {
      console.error('Failed to send invitation email:', emailError);
    });

    return NextResponse.json({
      success: true,
      data: {
        company_id: newCompany.id,
        company_name: newCompany.name,
        admin_user_id: newUser.id,
      },
      message: '会社と管理者ユーザーを作成しました。続けて施設を登録してください。',
    });
  } catch (error) {
    console.error('Error creating company and admin user:', error);
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
