import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';
import { getCurrentDateJST } from '@/lib/utils/timezone';
import { hasCompletedPasswordSetup } from '@/lib/auth/password-status';

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

    // 入力値バリデーション
    const adminName = String(body.admin_user.name).trim();
    const adminEmail = String(body.admin_user.email).trim();

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

    // Step 1: 会社の存在確認
    const { data: existingCompany, error: companyCheckError } = await supabase
      .from('m_companies')
      .select('id, name')
      .eq('id', body.company_id)
      .is('deleted_at', null)
      .single();

    if (companyCheckError && companyCheckError.code !== 'PGRST116') {
      console.error('Database error checking company existence:', companyCheckError);
      return NextResponse.json(
        { success: false, error: 'Internal Server Error' },
        { status: 500 }
      );
    }

    if (!existingCompany || companyCheckError?.code === 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // Step 2: メールアドレス重複チェック
    const { data: existingUser, error: emailCheckError } = await supabase
      .from('m_users')
      .select('id')
      .eq('email', adminEmail)
      .is('deleted_at', null)
      .single();

    if (emailCheckError && emailCheckError.code !== 'PGRST116') {
      console.error('Database error checking email uniqueness:', emailCheckError);
      return NextResponse.json(
        { success: false, error: 'Internal Server Error' },
        { status: 500 }
      );
    }

    // Step 3: Supabase Auth ユーザー作成
    const supabaseAdmin = await createAdminClient();

    if (existingUser) {
      // 既存ユーザーが存在する場合: last_sign_in_at を確認して再招待 or エラー
      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(existingUser.id);

      if (authUserError || !authUserData.user) {
        console.error('Failed to get auth user by id:', authUserError);
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      if (hasCompletedPasswordSetup(authUserData.user)) {
        // パスワード設定済み → 通常の重複エラー
        return NextResponse.json(
          { success: false, error: 'このメールアドレスは既に使用されています' },
          { status: 400 }
        );
      }

      // パスワード未設定 → 再招待フロー
      const originalAppMetadata = authUserData.user.app_metadata;

      // app_metadata を更新
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          role: 'company_admin',
          company_id: body.company_id,
          current_facility_id: null,
        },
      });

      if (updateMetaError) {
        console.error('Failed to update user app_metadata:', updateMetaError);
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      // 新しい招待リンクを生成
      // メールが確認済みの場合は 'invite' が失敗するため 'magiclink' を使用する
      const reinviteLinkType = authUserData.user.email_confirmed_at ? 'magiclink' : 'invite';
      const { data: reinviteLinkData, error: reinviteLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: reinviteLinkType,
        email: adminEmail,
      });

      if (reinviteLinkError || !reinviteLinkData) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            app_metadata: originalAppMetadata,
          });
        } catch (rollbackErr) {
          console.error('Failed to rollback app_metadata:', rollbackErr);
        }
        throw reinviteLinkError || new Error('Failed to generate reinvite link');
      }

      const reinviteUrl = reinviteLinkData.properties.action_link;
      const reinviteUrlObj = new URL(reinviteUrl);
      const reinviteTokenHash = reinviteUrlObj.searchParams.get('token_hash') || reinviteUrlObj.searchParams.get('token');
      const reinviteType = reinviteUrlObj.searchParams.get('type') || 'invite';

      if (!reinviteTokenHash) {
        console.error('Failed to extract token from reinvite link');
        try {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            app_metadata: originalAppMetadata,
          });
        } catch (rollbackErr) {
          console.error('Failed to rollback app_metadata:', rollbackErr);
        }
        return NextResponse.json(
          { success: false, error: 'Failed to generate valid invite link' },
          { status: 500 }
        );
      }

      const reinviteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
      if (!reinviteBaseUrl) {
        console.error('NEXT_PUBLIC_SITE_URL is not configured');
        try {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            app_metadata: originalAppMetadata,
          });
        } catch (rollbackErr) {
          console.error('Failed to rollback app_metadata:', rollbackErr);
        }
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }
      const inviteUrlForReinvite = `${reinviteBaseUrl}/password/setup?token_hash=${reinviteTokenHash}&type=${reinviteType}`;

      // m_users の情報を更新
      const hireDateValue = body.admin_user.hire_date || getCurrentDateJST();

      const { data: updatedUser, error: updateUserError } = await supabase
        .from('m_users')
        .update({
          company_id: body.company_id,
          name: adminName,
          name_kana: body.admin_user.name_kana || null,
          role: 'company_admin',
          hire_date: hireDateValue,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateUserError || !updatedUser) {
        console.error('Failed to update m_users for reinvite:', updateUserError);
        // app_metadata を元に戻す
        try {
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            app_metadata: originalAppMetadata,
          });
        } catch (rollbackErr) {
          console.error('Failed to rollback app_metadata:', rollbackErr);
        }
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
        companyName: existingCompany.name,
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
          company_id: existingCompany.id,
          company_name: existingCompany.name,
          admin_user_id: updatedUser.id,
          admin_user_name: updatedUser.name,
          admin_user_email: updatedUser.email,
        },
        message: '招待メールを再送しました',
      });
    }

    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
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
      email: adminEmail,
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
      console.error('Failed to extract token from invite link for company admin registration');
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    if (!baseUrl) {
      console.error('NEXT_PUBLIC_SITE_URL is not configured');
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: 'Internal Server Error' },
        { status: 500 }
      );
    }

    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // Step 5: m_users テーブルにユーザー情報を登録
    const hireDateValue = body.admin_user.hire_date || getCurrentDateJST();

    const { data: newUser, error: createUserError } = await supabase
      .from('m_users')
      .insert({
        id: authData.user.id,
        company_id: body.company_id,
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
        message: '会社管理者の登録に失敗しました',
      },
      { status: 500 }
    );
  }
}
