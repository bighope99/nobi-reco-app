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
      .eq('email', body.facility_admin.email)
      .is('deleted_at', null)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'このメールアドレスは既に使用されています' },
        { status: 400 }
      );
    }

    // Step 1: 施設作成
    const { data: newFacility, error: facilityError } = await supabase
      .from('m_facilities')
      .insert({
        company_id: companyId,
        name: body.facility.name,
        name_kana: body.facility.name_kana || null,
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
      email: body.facility_admin.email,
      email_confirm: false,
      app_metadata: {
        role: 'facility_admin',
        company_id: companyId,
        current_facility_id: newFacility.id,
      },
    });

    if (authCreateError || !authData.user) {
      // ロールバック: 施設削除
      await supabase.from('m_facilities').delete().eq('id', newFacility.id);
      throw authCreateError || new Error('Failed to create auth user');
    }

    // Step 3: 招待リンク生成
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: body.facility_admin.email,
    });

    if (linkError || !linkData) {
      // ロールバック
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_facilities').delete().eq('id', newFacility.id);
      throw linkError || new Error('Failed to generate invite link');
    }

    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    if (!tokenHash) {
      console.error('Failed to extract token from invite link for email:', body.facility_admin.email);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_facilities').delete().eq('id', newFacility.id);
      return NextResponse.json(
        { success: false, error: 'Failed to generate valid invite link' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // Step 4: m_users + _user_facility 作成
    const hireDateValue = body.facility_admin.hire_date || getCurrentDateJST();

    const { data: newUser, error: createUserError } = await supabase
      .from('m_users')
      .insert({
        id: authData.user.id,
        company_id: companyId,
        email: body.facility_admin.email,
        name: body.facility_admin.name,
        name_kana: body.facility_admin.name_kana || null,
        role: 'facility_admin',
        is_active: true,
        hire_date: hireDateValue,
        is_retired: false,
      })
      .select()
      .single();

    if (createUserError || !newUser) {
      // ロールバック
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_facilities').delete().eq('id', newFacility.id);
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
      await supabase.from('m_users').delete().eq('id', newUser.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabase.from('m_facilities').delete().eq('id', newFacility.id);
      throw userFacilityError;
    }

    // Step 5: company_admin の current_facility_id が null の場合、この施設で更新
    if (metadata.role === 'company_admin' && !metadata.current_facility_id) {
      await supabaseAdmin.auth.admin.updateUserById(metadata.user_id, {
        app_metadata: {
          role: metadata.role,
          company_id: metadata.company_id,
          current_facility_id: newFacility.id,
        },
      });
    }

    // Step 6: 招待メール送信
    try {
      const emailHtml = buildUserInvitationEmailHtml({
        userName: newUser.name,
        userEmail: newUser.email,
        role: newUser.role,
        companyName: company.name,
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
      console.error('Failed to send invitation email:', emailError);
    }

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
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
