import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';
import { getCurrentDateJST } from '@/lib/utils/timezone';

/**
 * POST /api/admin/company-admins
 * 既存の会社に会社管理者ユーザーを追加（site_adminのみ）
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
    if (!body.company_id || !body.admin_user?.name || !body.admin_user?.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: company_id, admin_user.name, and admin_user.email are required'
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Step 1: 会社の存在確認
    const { data: existingCompany, error: companyCheckError } = await supabase
      .from('m_companies')
      .select('id, name')
      .eq('id', body.company_id)
      .is('deleted_at', null)
      .single();

    if (companyCheckError || !existingCompany) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Step 2: メールアドレス重複チェック
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

    // Step 3: Supabase Auth ユーザー作成
    const supabaseAdmin = await createAdminClient();

    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: body.admin_user.email,
      email_confirm: false,
      app_metadata: {
        role: 'company_admin',
        company_id: body.company_id,
        current_facility_id: null,
      },
    });

    if (authCreateError || !authData.user) {
      throw authCreateError || new Error('Failed to create auth user');
    }

    // Step 4: 招待リンク生成
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: body.admin_user.email,
    });

    if (linkError || !linkData) {
      // ロールバック: Auth ユーザー削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw linkError || new Error('Failed to generate invite link');
    }

    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    if (!tokenHash) {
      console.error('Failed to extract token from invite link for email:', body.admin_user.email);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // Step 5: m_users テーブルにユーザー情報を登録
    const hireDateValue = body.admin_user.hire_date || getCurrentDateJST();

    const { data: newUser, error: createUserError } = await supabase
      .from('m_users')
      .insert({
        id: authData.user.id,
        company_id: body.company_id,
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
      // ロールバック: Auth ユーザー削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw createUserError;
    }

    // Step 6: 招待メール送信（fire-and-forget: レスポンスをブロックしない）
    const emailHtml = buildUserInvitationEmailHtml({
      userName: newUser.name,
      userEmail: newUser.email,
      role: newUser.role,
      companyName: existingCompany.name,
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
        company_id: existingCompany.id,
        company_name: existingCompany.name,
        admin_user_id: newUser.id,
        admin_user_name: newUser.name,
        admin_user_email: newUser.email,
      },
      message: '会社管理者を登録しました',
    });
  } catch (error) {
    console.error('Error creating company admin user:', error);
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
