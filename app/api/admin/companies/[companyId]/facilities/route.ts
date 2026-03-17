import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';
import { getCurrentDateJST } from '@/lib/utils/timezone';

/**
 * POST /api/admin/companies/[companyId]/facilities
 * 施設 + 施設管理者ユーザー作成
 * 認証: site_admin または当該会社の company_admin
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await props.params;
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 権限チェック: site_admin または当該会社の company_admin
    if (metadata.role === 'site_admin') {
      // OK
    } else if (metadata.role === 'company_admin' && metadata.company_id === companyId) {
      // OK
    } else {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 必須パラメータチェック
    if (!body.facility?.name || !body.facility_admin?.name || !body.facility_admin?.email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: facility.name, facility_admin.name, and facility_admin.email are required',
        },
        { status: 400 }
      );
    }

    // 入力値バリデーション
    const facilityName = String(body.facility.name).trim();
    const adminEmail = String(body.facility_admin.email).trim();
    const adminName = String(body.facility_admin.name).trim();

    if (facilityName.length > 255) {
      return NextResponse.json(
        { success: false, error: '施設名は255文字以内で入力してください' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスの形式が正しくありません' },
        { status: 400 }
      );
    }

    if (adminEmail.length > 255) {
      return NextResponse.json(
        { success: false, error: 'メールアドレスは255文字以内で入力してください' },
        { status: 400 }
      );
    }

    if (adminName.length > 100) {
      return NextResponse.json(
        { success: false, error: '管理者氏名は100文字以内で入力してください' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 会社の存在確認
    const { data: company, error: companyCheckError } = await supabase
      .from('m_companies')
      .select('id, name')
      .eq('id', companyId)
      .is('deleted_at', null)
      .single();

    if (companyCheckError || !company) {
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }

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
          { success: false, error: 'このメールアドレスは既に使用されています' },
          { status: 400 }
        );
      }

      // 未サインイン → 再招待フロー
      // Re-invite Step 1: 新しい施設を作成
      const { data: newFacility, error: facilityError } = await supabase
        .from('m_facilities')
        .insert({
          company_id: companyId,
          name: facilityName,
          name_kana: body.facility.name_kana?.trim() || null,
          postal_code: body.facility.postal_code || null,
          address: body.facility.address || null,
          phone: body.facility.phone || null,
          capacity: body.facility.capacity ? Number(body.facility.capacity) : null,
          is_active: true,
        })
        .select()
        .single();

      if (facilityError || !newFacility) {
        throw facilityError || new Error('Failed to create facility for reinvite');
      }

      // Re-invite Step 2: app_metadata を更新
      const { error: updateMetaError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          role: 'facility_admin',
          company_id: companyId,
          current_facility_id: newFacility.id,
        },
      });

      if (updateMetaError) {
        console.error('Failed to update user app_metadata for reinvite:', updateMetaError);
        try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      // Re-invite Step 3: 新しい招待リンクを生成
      const { data: reinviteLinkData, error: reinviteLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: adminEmail,
      });

      if (reinviteLinkError || !reinviteLinkData) {
        try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
        throw reinviteLinkError || new Error('Failed to generate reinvite link');
      }

      const reinviteUrl = reinviteLinkData.properties.action_link;
      const reinviteUrlObj = new URL(reinviteUrl);
      const reinviteTokenHash = reinviteUrlObj.searchParams.get('token_hash') || reinviteUrlObj.searchParams.get('token');
      const reinviteType = reinviteUrlObj.searchParams.get('type') || 'invite';

      if (!reinviteTokenHash) {
        console.error('Failed to extract token from reinvite link for facility admin');
        try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
        return NextResponse.json(
          { success: false, error: 'Failed to generate valid invite link' },
          { status: 500 }
        );
      }

      const reinviteBaseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const inviteUrlForReinvite = `${reinviteBaseUrl}/password/setup?token_hash=${reinviteTokenHash}&type=${reinviteType}`;

      // Re-invite Step 4: m_users を更新
      const hireDateValue = body.facility_admin.hire_date || getCurrentDateJST();

      const { data: updatedUser, error: updateUserError } = await supabase
        .from('m_users')
        .update({
          company_id: companyId,
          name: adminName,
          name_kana: body.facility_admin.name_kana?.trim() || null,
          role: 'facility_admin',
          hire_date: hireDateValue,
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateUserError || !updatedUser) {
        console.error('Failed to update m_users for reinvite:', updateUserError);
        try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      // Re-invite Step 5: _user_facility に新施設を紐付け
      const { error: userFacilityError } = await supabase
        .from('_user_facility')
        .insert({
          user_id: existingUser.id,
          facility_id: newFacility.id,
          start_date: hireDateValue,
          is_current: true,
          is_primary: true,
        });

      if (userFacilityError) {
        console.error('Failed to insert _user_facility for reinvite:', userFacilityError);
        try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
        return NextResponse.json(
          { success: false, error: 'Internal Server Error' },
          { status: 500 }
        );
      }

      // Re-invite Step 6: company_admin の current_facility_id が null の場合、この施設で更新
      if (metadata.role === 'company_admin' && !metadata.current_facility_id) {
        const { error: updateAdminError } = await supabaseAdmin.auth.admin.updateUserById(metadata.user_id, {
          app_metadata: {
            role: metadata.role,
            company_id: metadata.company_id,
            current_facility_id: newFacility.id,
          },
        });
        if (updateAdminError) {
          console.error('Failed to update company_admin current_facility_id:', updateAdminError);
        }
      }

      // Re-invite Step 7: 招待メール再送信（fire-and-forget）
      const reinviteEmailHtml = buildUserInvitationEmailHtml({
        userName: updatedUser.name,
        userEmail: updatedUser.email,
        role: updatedUser.role,
        companyName: company.name,
        facilityName: newFacility.name,
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
        message: '招待メールを再送しました',
      });
    }

    // Step 1: 施設作成
    const { data: newFacility, error: facilityError } = await supabase
      .from('m_facilities')
      .insert({
        company_id: companyId,
        name: facilityName,
        name_kana: body.facility.name_kana?.trim() || null,
        postal_code: body.facility.postal_code || null,
        address: body.facility.address || null,
        phone: body.facility.phone || null,
        capacity: body.facility.capacity ? Number(body.facility.capacity) : null,
        is_active: true,
      })
      .select()
      .single();

    if (facilityError || !newFacility) {
      throw facilityError || new Error('Failed to create facility');
    }

    // Step 2: Supabase Auth ユーザー作成（facility_admin）
    const supabaseAdmin = await createAdminClient();

    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      email_confirm: false,
      app_metadata: {
        role: 'facility_admin',
        company_id: companyId,
        current_facility_id: newFacility.id,
      },
    });

    if (authCreateError || !authData.user) {
      // ロールバック: 施設削除
      try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
      throw authCreateError || new Error('Failed to create auth user');
    }

    // Step 3: 招待リンク生成
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: adminEmail,
    });

    if (linkError || !linkData) {
      // ロールバック
      try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch (e) { console.error('Rollback failed (auth):', e); }
      try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
      throw linkError || new Error('Failed to generate invite link');
    }

    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    if (!tokenHash) {
      console.error('Failed to extract token from invite link for facility admin user');
      try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch (e) { console.error('Rollback failed (auth):', e); }
      try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    if (!baseUrl) {
      console.error('NEXT_PUBLIC_SITE_URL is not configured');
      try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch (e) { console.error('Rollback failed (auth):', e); }
      try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // Step 4: m_users + _user_facility 作成
    const hireDateValue = body.facility_admin.hire_date || getCurrentDateJST();

    const { data: newUser, error: createUserError } = await supabase
      .from('m_users')
      .insert({
        id: authData.user.id,
        company_id: companyId,
        email: adminEmail,
        name: adminName,
        name_kana: body.facility_admin.name_kana?.trim() || null,
        role: 'facility_admin',
        is_active: true,
        hire_date: hireDateValue,
        is_retired: false,
      })
      .select()
      .single();

    if (createUserError || !newUser) {
      // ロールバック
      try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch (e) { console.error('Rollback failed (auth):', e); }
      try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
      throw createUserError || new Error('Failed to create user');
    }

    // _user_facility 作成
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
      // ロールバック
      try { await supabase.from('m_users').delete().eq('id', newUser.id); } catch (e) { console.error('Rollback failed (m_users):', e); }
      try { await supabaseAdmin.auth.admin.deleteUser(authData.user.id); } catch (e) { console.error('Rollback failed (auth):', e); }
      try { await supabase.from('m_facilities').delete().eq('id', newFacility.id); } catch (e) { console.error('Rollback failed (facility):', e); }
      throw userFacilityError;
    }

    // Step 5: company_admin の current_facility_id が null の場合、この施設で更新
    if (metadata.role === 'company_admin' && !metadata.current_facility_id) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(metadata.user_id, {
        app_metadata: {
          role: metadata.role,
          company_id: metadata.company_id,
          current_facility_id: newFacility.id,
        },
      });
      if (updateError) {
        console.error('Failed to update company_admin current_facility_id:', updateError);
      }
    }

    // Step 6: 招待メール送信（fire-and-forget: レスポンスをブロックしない）
    const emailHtml = buildUserInvitationEmailHtml({
      userName: newUser.name,
      userEmail: newUser.email,
      role: newUser.role,
      companyName: company.name,
      facilityName: newFacility.name,
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
        facility_id: newFacility.id,
        facility_name: newFacility.name,
        facility_admin_id: newUser.id,
      },
      message: '施設と施設管理者を作成しました。',
    });
  } catch (error) {
    console.error('Error creating facility and admin:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
