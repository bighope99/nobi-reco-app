import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';
import { getCurrentDateJST } from '@/lib/utils/timezone';
import { hasCompletedPasswordSetup } from '@/lib/auth/password-status';

/**
 * POST /api/admin/company-admins
 * 既存の会社にユーザーを追加（site_admin または company_admin）
 * company_admin は自社のみ操作可能
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

    // site_admin または company_admin のみアクセス可能
    if (metadata.role !== 'site_admin' && metadata.role !== 'company_admin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // company_admin は自社のみ操作可能
    if (metadata.role === 'company_admin' && metadata.company_id !== body.company_id) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const targetRole: string = body.role || 'company_admin';
    const validRoles = ['company_admin', 'facility_admin', 'staff'];
    if (!validRoles.includes(targetRole)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const facilityId: string | undefined = body.facility_id;

    // facility_admin, staff は facility_id 必須
    if ((targetRole === 'facility_admin' || targetRole === 'staff') && !facilityId) {
      return NextResponse.json(
        { success: false, error: 'facility_id is required for facility_admin and staff roles' },
        { status: 400 }
      );
    }

    // 入力値のトリミング（バリデーション前に実施）
    const adminName = String(body.admin_user?.name ?? '').trim();
    const adminEmail = body.admin_user?.email == null ? null : String(body.admin_user.email).trim() || null;

    // 必須パラメータチェック
    if (!body.company_id || !adminName) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: company_id and admin_user.name are required'
        },
        { status: 400 }
      );
    }

    // staff 以外はメール必須
    if (targetRole !== 'staff' && !adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'admin_user.email is required for company_admin and facility_admin roles'
        },
        { status: 400 }
      );
    }

    if (adminName.length > 100) {
      return NextResponse.json(
        { success: false, error: '氏名は100文字以内で入力してください' },
        { status: 400 }
      );
    }

    if (adminEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail) || adminEmail.length > 255) {
        return NextResponse.json(
          { success: false, error: 'メールアドレスの形式が正しくないか、255文字を超えています' },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Step 1: 会社の存在確認
    const { data: existingCompany, error: companyCheckError } = await supabase
      .from('m_companies')
      .select('id, name')
      .eq('id', body.company_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (companyCheckError) {
      console.error('Database error checking company existence:', companyCheckError);
      return NextResponse.json(
        { success: false, error: 'Internal Server Error' },
        { status: 500 }
      );
    }

    if (!existingCompany) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

    // 施設の存在確認（facility_id が指定されている場合）
    if (facilityId) {
      const { data: facility, error: facilityCheckError } = await supabase
        .from('m_facilities')
        .select('id')
        .eq('id', facilityId)
        .eq('company_id', body.company_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (facilityCheckError) {
        console.error('Database error checking facility:', facilityCheckError);
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      if (!facility) {
        return NextResponse.json(
          { success: false, error: '指定された施設が見つかりません' },
          { status: 404 }
        );
      }
    }

    const supabaseAdmin = await createAdminClient();

    // メールなしスタッフの場合: auth.users を作成せず m_users に直接登録
    if (!adminEmail) {
      const hireDateValue = body.admin_user.hire_date || getCurrentDateJST();
      const staffId = crypto.randomUUID();

      const { data: newStaff, error: createStaffError } = await supabase
        .from('m_users')
        .insert({
          id: staffId,
          company_id: body.company_id,
          email: null,
          name: adminName,
          name_kana: body.admin_user.name_kana || null,
          role: targetRole,
          is_active: true,
          hire_date: hireDateValue,
          phone: body.admin_user.phone || null,
          is_retired: false,
        })
        .select()
        .single();

      if (createStaffError || !newStaff) {
        throw createStaffError || new Error('Failed to create staff user');
      }

      // 施設との紐付け
      if (facilityId) {
        const { error: facilityLinkError } = await supabaseAdmin.from('_user_facility').insert({
          user_id: newStaff.id,
          facility_id: facilityId,
          start_date: hireDateValue,
          is_current: true,
          is_primary: true,
        });

        if (facilityLinkError) {
          console.error('Failed to insert _user_facility:', facilityLinkError);
          // ロールバック: m_users 削除
          await supabaseAdmin.from('m_users').delete().eq('id', newStaff.id);
          throw facilityLinkError;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          company_id: existingCompany.id,
          company_name: existingCompany.name,
          admin_user_id: newStaff.id,
          admin_user_name: newStaff.name,
          admin_user_email: null,
        },
        message: 'スタッフを登録しました',
      });
    }

    // Step 2: メールアドレス重複チェック
    const { data: existingUser, error: emailCheckError } = await supabase
      .from('m_users')
      .select('id')
      .eq('email', adminEmail)
      .is('deleted_at', null)
      .maybeSingle();

    if (emailCheckError) {
      console.error('Database error checking email uniqueness:', emailCheckError);
      return NextResponse.json(
        { success: false, error: 'Internal Server Error' },
        { status: 500 }
      );
    }

    // Step 3: Supabase Auth ユーザー作成
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

      // ロールバック用に元の m_users データを取得
      const { data: originalMUser, error: originalMUserError } = await supabase
        .from('m_users')
        .select('company_id, name, name_kana, role, hire_date, phone')
        .eq('id', existingUser.id)
        .single();

      if (originalMUserError || !originalMUser) {
        console.error('Failed to fetch original m_users data:', originalMUserError);
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      // company_admin が他社の既存ユーザーを再招待することを防止
      if (metadata.role === 'company_admin' && originalMUser.company_id !== metadata.company_id) {
        return NextResponse.json(
          { success: false, error: 'Permission denied' },
          { status: 403 }
        );
      }

      // app_metadata を更新
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          role: targetRole,
          company_id: body.company_id,
          current_facility_id: facilityId || null,
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

      const reinviteBaseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const inviteUrlForReinvite = `${reinviteBaseUrl}/password/setup?token_hash=${reinviteTokenHash}&type=${reinviteType}`;

      // m_users の情報を更新
      const hireDateValue = body.admin_user.hire_date || getCurrentDateJST();

      const { data: updatedUser, error: updateUserError } = await supabase
        .from('m_users')
        .update({
          company_id: body.company_id,
          name: adminName,
          name_kana: body.admin_user.name_kana || null,
          role: targetRole,
          hire_date: hireDateValue,
          phone: body.admin_user.phone || null,
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

      // 施設との紐付け（再招待時）
      if (facilityId) {
        const { error: facilityLinkError } = await supabaseAdmin.from('_user_facility').insert({
          user_id: updatedUser.id,
          facility_id: facilityId,
          start_date: hireDateValue,
          is_current: true,
          is_primary: true,
        });

        if (facilityLinkError && facilityLinkError.code !== '23505') {
          console.error('Failed to insert _user_facility for reinvite:', facilityLinkError);
          // ロールバック: m_users を元に戻す
          try {
            await supabase
              .from('m_users')
              .update({
                company_id: originalMUser.company_id,
                name: originalMUser.name,
                name_kana: originalMUser.name_kana,
                role: originalMUser.role,
                hire_date: originalMUser.hire_date,
                phone: originalMUser.phone,
              })
              .eq('id', existingUser.id);
          } catch (rollbackErr) {
            console.error('Failed to rollback m_users:', rollbackErr);
          }
          // ロールバック: app_metadata を元に戻す
          try {
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
              app_metadata: originalAppMetadata,
            });
          } catch (rollbackErr) {
            console.error('Failed to rollback app_metadata:', rollbackErr);
          }
          return NextResponse.json(
            { success: false, error: '施設の紐付けに失敗しました' },
            { status: 500 }
          );
        }
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
        role: targetRole,
        company_id: body.company_id,
        current_facility_id: facilityId || null,
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
      console.error('Failed to extract token from invite link for user registration');
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
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
        role: targetRole,
        is_active: true,
        hire_date: hireDateValue,
        phone: body.admin_user.phone || null,
        is_retired: false,
      })
      .select()
      .single();

    if (createUserError) {
      // ロールバック: Auth ユーザー削除
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw createUserError;
    }

    // 施設との紐付け
    if (facilityId) {
      const { error: facilityLinkError } = await supabaseAdmin.from('_user_facility').insert({
        user_id: newUser.id,
        facility_id: facilityId,
        start_date: hireDateValue,
        is_current: true,
        is_primary: true,
      });

      if (facilityLinkError) {
        console.error('Failed to insert _user_facility:', facilityLinkError);
        // ロールバック: Auth ユーザー + m_users 削除
        await supabaseAdmin.from('m_users').delete().eq('id', newUser.id);
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        throw facilityLinkError;
      }
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

    const roleLabel = targetRole === 'company_admin' ? '会社管理者' :
      targetRole === 'facility_admin' ? '施設管理者' : 'スタッフ';

    return NextResponse.json({
      success: true,
      data: {
        company_id: existingCompany.id,
        company_name: existingCompany.name,
        admin_user_id: newUser.id,
        admin_user_name: newUser.name,
        admin_user_email: newUser.email,
      },
      message: `${roleLabel}を登録しました`,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        message: 'ユーザーの登録に失敗しました',
      },
      { status: 500 }
    );
  }
}
