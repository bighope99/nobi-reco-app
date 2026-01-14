import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';

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
            .single()
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
 * 会社+施設+代表者ユーザー作成（site_adminのみ）
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

    // 必須パラメータチェック
    if (!body.company?.name || !body.facility?.name || !body.admin_user?.name || !body.admin_user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: company.name, facility.name, admin_user.name, and admin_user.email are required'
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

    // Step 2: 施設作成
    const { data: newFacility, error: facilityError } = await supabase
      .from('m_facilities')
      .insert({
        company_id: newCompany.id,
        name: body.facility.name,
        name_kana: body.facility.name_kana,
        postal_code: body.facility.postal_code,
        address: body.facility.address,
        phone: body.facility.phone,
        email: body.facility.email,
        capacity: body.facility.capacity,
        is_active: true,
      })
      .select()
      .single();

    if (facilityError) {
      // ロールバック: 会社削除
      await supabase
        .from('m_companies')
        .delete()
        .eq('id', newCompany.id);

      throw facilityError;
    }

    // Step 3: Supabase Auth ユーザー作成
    const supabaseAdmin = await createAdminClient();

    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: body.admin_user.email,
      email_confirm: false, // メール確認は招待リンクで行う
      app_metadata: {
        role: 'company_admin',
        company_id: newCompany.id,
        current_facility_id: newFacility.id,
      },
    });

    if (authCreateError || !authData.user) {
      // ロールバック: 施設削除 → 会社削除
      await supabase
        .from('m_facilities')
        .delete()
        .eq('id', newFacility.id);

      await supabase
        .from('m_companies')
        .delete()
        .eq('id', newCompany.id);

      throw authCreateError || new Error('Failed to create auth user');
    }

    // Step 4: 招待リンク生成
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: body.admin_user.email,
    });

    if (linkError || !linkData) {
      // ロールバック: Auth ユーザー削除 → 施設削除 → 会社削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      await supabase
        .from('m_facilities')
        .delete()
        .eq('id', newFacility.id);

      await supabase
        .from('m_companies')
        .delete()
        .eq('id', newCompany.id);

      throw linkError || new Error('Failed to generate invite link');
    }

    // トークンハッシュの抽出
    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    if (!tokenHash) {
      console.error('Failed to extract token from invite link:', supabaseUrl);

      // ロールバック: Auth ユーザー削除 → 施設削除 → 会社削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      await supabase
        .from('m_facilities')
        .delete()
        .eq('id', newFacility.id);

      await supabase
        .from('m_companies')
        .delete()
        .eq('id', newCompany.id);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate valid invite link',
          message: 'Token hash is missing from the generated link',
        },
        { status: 500 }
      );
    }

    // 招待URLの構築
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // Step 5: m_users テーブルにユーザー情報を登録
    const hireDateValue = body.admin_user.hire_date || new Date().toISOString().split('T')[0];

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
      // ロールバック: Auth ユーザー削除 → 施設削除 → 会社削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      await supabase
        .from('m_facilities')
        .delete()
        .eq('id', newFacility.id);

      await supabase
        .from('m_companies')
        .delete()
        .eq('id', newCompany.id);

      throw createUserError;
    }

    // Step 6: _user_facility に紐付け
    const { error: userFacilityError } = await supabase
      .from('_user_facility')
      .insert({
        user_id: newUser.id,
        facility_id: newFacility.id,
        start_date: hireDateValue,
        is_current: true,
        is_primary: true,
      });

    if (userFacilityError) {
      // ロールバック: m_users削除 → Auth ユーザー削除 → 施設削除 → 会社削除
      await supabase
        .from('m_users')
        .delete()
        .eq('id', newUser.id);

      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      await supabase
        .from('m_facilities')
        .delete()
        .eq('id', newFacility.id);

      await supabase
        .from('m_companies')
        .delete()
        .eq('id', newCompany.id);

      throw userFacilityError;
    }

    // Step 7: 招待メール送信
    try {
      const emailHtml = buildUserInvitationEmailHtml({
        userName: newUser.name,
        userEmail: newUser.email,
        role: newUser.role,
        companyName: newCompany.name,
        facilityName: newFacility.name,
        inviteUrl,
      });

      await sendWithGas({
        to: newUser.email,
        subject: '【のびレコ】アカウント登録のご案内',
        htmlBody: emailHtml,
        senderName: 'のびレコ',
      });
    } catch (emailError) {
      // メール送信エラーはログに記録するが、処理自体は成功とする
      console.error('Failed to send invitation email:', emailError);
    }

    return NextResponse.json({
      success: true,
      data: {
        company_id: newCompany.id,
        company_name: newCompany.name,
        facility_id: newFacility.id,
        facility_name: newFacility.name,
        admin_user_id: newUser.id,
      },
      message: '会社、施設、代表者ユーザーを作成しました',
    });
  } catch (error) {
    console.error('Error creating company, facility, and admin user:', error);
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
