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

    // 会社IDリストを抽出
    const companyIds = (companies || []).map((c) => c.id);

    // 施設数と管理者を一括取得（N+1クエリ防止）
    const [facilitiesResult, adminUsersResult] = await Promise.all([
      companyIds.length > 0
        ? supabase
            .from('m_facilities')
            .select('company_id')
            .in('company_id', companyIds)
            .is('deleted_at', null)
        : Promise.resolve({ data: [] }),
      companyIds.length > 0
        ? supabase
            .from('m_users')
            .select('id, name, email, company_id')
            .in('company_id', companyIds)
            .eq('role', 'company_admin')
            .is('deleted_at', null)
        : Promise.resolve({ data: [] }),
    ]);

    // 施設数マップ構築
    const facilityCountMap = new Map<string, number>();
    (facilitiesResult.data || []).forEach((f: { company_id: string }) => {
      facilityCountMap.set(f.company_id, (facilityCountMap.get(f.company_id) || 0) + 1);
    });

    // 管理者マップ構築（会社ごとに最初の1人）
    const adminUserMap = new Map<string, { id: string; name: string; email: string }>();
    (adminUsersResult.data || []).forEach((u: { id: string; name: string; email: string; company_id: string }) => {
      if (!adminUserMap.has(u.company_id)) {
        adminUserMap.set(u.company_id, { id: u.id, name: u.name, email: u.email });
      }
    });

    // 同期的にデータを結合
    const companiesWithFacilityCount = (companies || []).map((company) => {
      const adminUser = adminUserMap.get(company.id);
      return {
        ...company,
        facilities_count: facilityCountMap.get(company.id) || 0,
        admin_user: adminUser || null,
      };
    });

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

    // 入力値バリデーション
    const companyName = String(body.company.name).trim();
    const adminName = String(body.admin_user.name).trim();
    const adminEmail = String(body.admin_user.email).trim();

    if (companyName.length > 100) {
      return NextResponse.json(
        { success: false, error: '会社名は100文字以内で入力してください' },
        { status: 400 }
      );
    }

    if (adminName.length > 100) {
      return NextResponse.json(
        { success: false, error: '管理者氏名は100文字以内で入力してください' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail) || adminEmail.length > 255) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスの形式が正しくないか、255文字を超えています' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // メールアドレス重複チェック
    const { data: existingUser } = await supabase
      .from('m_users')
      .select('id')
      .eq('email', adminEmail)
      .is('deleted_at', null)
      .single();

    if (existingUser) {
      // 既存ユーザーが存在する場合: last_sign_in_at を確認して再招待 or エラー
      const supabaseAdmin = await createAdminClient();

      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(existingUser.id);

      if (authUserError || !authUserData.user) {
        console.error('Failed to get auth user by id:', authUserError);
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      if (authUserData.user.last_sign_in_at !== null) {
        // 既にサインイン済み → 通常の重複エラー
        return NextResponse.json(
          { success: false, error: 'Email already exists' },
          { status: 400 }
        );
      }

      // 未サインイン → 再招待フロー
      // Step 1: 新しい会社を先に作成
      const { data: newCompany, error: companyError } = await supabase
        .from('m_companies')
        .insert({
          name: companyName,
          name_kana: body.company.name_kana,
          postal_code: body.company.postal_code,
          address: body.company.address,
          phone: body.company.phone,
          email: body.company.email,
          is_active: true,
        })
        .select()
        .single();

      if (companyError || !newCompany) {
        throw companyError || new Error('Failed to create company');
      }

      // app_metadata を更新
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          role: 'company_admin',
          company_id: newCompany.id,
          current_facility_id: null,
        },
      });

      if (updateMetaError) {
        console.error('Failed to update user app_metadata:', updateMetaError);
        await supabase.from('m_companies').delete().eq('id', newCompany.id);
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      // 新しい招待リンクを生成
      const { data: reinviteLinkData, error: reinviteLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: adminEmail,
      });

      if (reinviteLinkError || !reinviteLinkData) {
        await supabase.from('m_companies').delete().eq('id', newCompany.id);
        throw reinviteLinkError || new Error('Failed to generate reinvite link');
      }

      const reinviteUrl = reinviteLinkData.properties.action_link;
      const reinviteUrlObj = new URL(reinviteUrl);
      const reinviteTokenHash = reinviteUrlObj.searchParams.get('token_hash') || reinviteUrlObj.searchParams.get('token');
      const reinviteType = reinviteUrlObj.searchParams.get('type') || 'invite';

      if (!reinviteTokenHash) {
        console.error('Failed to extract token from reinvite link');
        await supabase.from('m_companies').delete().eq('id', newCompany.id);
        return NextResponse.json(
          { success: false, error: 'Failed to generate valid invite link' },
          { status: 500 }
        );
      }

      const reinviteBaseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const inviteUrlForReinvite = `${reinviteBaseUrl}/password/setup?token_hash=${reinviteTokenHash}&type=${reinviteType}`;

      // m_users の情報を更新
      const hireDateValueReinvite = body.admin_user.hire_date || getCurrentDateJST();

      const { data: updatedUser, error: updateUserError } = await supabase
        .from('m_users')
        .update({
          company_id: newCompany.id,
          name: adminName,
          name_kana: body.admin_user.name_kana || null,
          role: 'company_admin',
          hire_date: hireDateValueReinvite,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateUserError || !updatedUser) {
        console.error('Failed to update m_users for reinvite:', updateUserError);
        await supabase.from('m_companies').delete().eq('id', newCompany.id);
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      // 招待メール再送信（fire-and-forget）
      const reinviteEmailHtml = buildUserInvitationEmailHtml({
        userName: updatedUser.name,
        userEmail: updatedUser.email,
        role: updatedUser.role,
        companyName: newCompany.name,
        inviteUrl: inviteUrlForReinvite,
      });

      sendWithGas({
        to: updatedUser.email,
        subject: '【のびレコ】アカウント登録のご案内',
        htmlBody: reinviteEmailHtml,
        senderName: 'のびレコ',
      }).catch((emailError) => {
        console.error('Failed to send reinvitation email:', emailError);
      });

      return NextResponse.json({
        success: true,
        data: {
          company_id: newCompany.id,
          company_name: newCompany.name,
          admin_user_id: updatedUser.id,
        },
        message: '招待メールを再送しました',
      });
    }

    // Step 1: 会社作成
    const { data: newCompany, error: companyError } = await supabase
      .from('m_companies')
      .insert({
        name: companyName,
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
      email: adminEmail,
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
      email: adminEmail,
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
      console.error('Failed to extract token from invite link for company admin user');
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_companies').delete().eq('id', newCompany.id);
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    if (!baseUrl) {
      console.error('NEXT_PUBLIC_SITE_URL is not configured');
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_companies').delete().eq('id', newCompany.id);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // Step 4: m_users テーブルにユーザー情報を登録
    const hireDateValue = body.admin_user.hire_date || getCurrentDateJST();

    const { data: newUser, error: createUserError } = await supabase
      .from('m_users')
      .insert({
        id: authData.user.id,
        company_id: newCompany.id,
        email: adminEmail,
        name: adminName,
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
      },
      { status: 500 }
    );
  }
}
