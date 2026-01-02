import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';

/**
 * GET /api/users
 * 職員一覧取得
 */
export async function GET(request: NextRequest) {
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

    const { role, company_id, current_facility_id } = metadata;

    // 権限チェック（staffは閲覧不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // リクエストパラメータ取得
    const searchParams = request.nextUrl.searchParams;
    const roleFilter = searchParams.get('role');
    const isActiveFilter = searchParams.get('is_active');
    const search = searchParams.get('search') || '';

    // ユーザー一覧取得クエリ
    let query = supabase
      .from('m_users')
      .select(
        `
        id,
        email,
        name,
        name_kana,
        role,
        phone,
        hire_date,
        is_active,
        created_at,
        updated_at,
        _user_facility!inner (
          facility_id
        )
      `
      )
      .is('deleted_at', null)
      .eq('company_id', company_id); // 会社でフィルター

    // 施設フィルター（site_admin以外の場合のみ適用）
    if (role !== 'site_admin' && current_facility_id) {
      query = query.eq('_user_facility.facility_id', current_facility_id);
      query = query.eq('_user_facility.is_current', true);
    }

    // ロールフィルター
    if (roleFilter) {
      query = query.eq('role', roleFilter);
    }

    // アクティブフィルター
    if (isActiveFilter !== null) {
      query = query.eq('is_active', isActiveFilter === 'true');
    }

    // 検索フィルター
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data: usersData, error: usersError } = await query.order('role').order('name');

    if (usersError) {
      throw usersError;
    }

    // 各ユーザーの担当クラスを取得
    const usersWithDetails = await Promise.all(
      (usersData || []).map(async (u: any) => {
        // 担当クラス取得
        const { data: classAssignments } = await supabase
          .from('_user_class')
          .select(
            `
            is_main,
            m_classes!inner (
              id,
              name
            )
          `
          )
          .eq('user_id', u.id)
          .eq('is_current', true);

        const assignedClasses =
          classAssignments?.map((ca: any) => ({
            class_id: ca.m_classes.id,
            class_name: ca.m_classes.name,
            is_main: ca.is_main,
          })) || [];

        return {
          user_id: u.id,
          email: u.email,
          name: u.name,
          name_kana: u.name_kana,
          role: u.role,
          phone: u.phone,
          hire_date: u.hire_date,
          is_active: u.is_active,
          assigned_classes: assignedClasses,
          last_login_at: u.last_login_at,
          created_at: u.created_at,
          updated_at: u.updated_at,
        };
      })
    );

    // 統計情報
    const totalUsers = usersWithDetails.length;
    const activeUsers = usersWithDetails.filter((u) => u.is_active).length;
    const byRole = usersWithDetails.reduce((acc: any, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        users: usersWithDetails,
        total: totalUsers,
        summary: {
          total_users: totalUsers,
          active_users: activeUsers,
          by_role: byRole,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
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
 * POST /api/users
 * 職員新規登録
 */
export async function POST(request: NextRequest) {
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

    const { role, company_id, current_facility_id } = metadata;

    // 権限チェック（staffは作成不可）
    if (role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 必須パラメータチェック
    if (!body.email || !body.name || !body.role) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // メールアドレス重複チェック
    const { data: existingUser } = await supabase
      .from('m_users')
      .select('id')
      .eq('email', body.email)
      .is('deleted_at', null)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // 施設IDの決定（site_adminの場合はbody.facility_idを使用）
    const targetFacilityId = role === 'site_admin'
      ? (body.facility_id || current_facility_id)
      : current_facility_id;

    // Admin クライアントを作成（サービスロールキー使用）
    const supabaseAdmin = await createAdminClient();

    // Supabase Auth にユーザーを作成（メール送信なし）
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      body.email,
      {
        data: {
          role: body.role,
          company_id: company_id,
          current_facility_id: targetFacilityId || null,
        },
      }
    );

    if (inviteError || !inviteData?.user) {
      throw inviteError || new Error('Failed to invite user');
    }

    const { error: updateMetadataError } = await supabaseAdmin.auth.admin.updateUserById(
      inviteData.user.id,
      {
        app_metadata: {
          role: body.role,
          company_id: company_id,
          current_facility_id: targetFacilityId || null,
        },
      }
    );

    if (updateMetadataError) {
      throw updateMetadataError;
    }

    const generateInviteLink = supabaseAdmin.auth.admin.generateLink;
    const linkResult =
      typeof generateInviteLink === 'function'
        ? await generateInviteLink({ type: 'invite', email: body.email })
        : null;
    const linkData = linkResult?.data;
    const linkError = linkResult?.error;

    if (linkError) {
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      throw linkError;
    }

    // Supabaseが生成したURLからトークンハッシュを抽出
    const supabaseUrl = linkData?.properties?.action_link;
    const inviteUrl = supabaseUrl
      ? (() => {
          const urlObj = new URL(supabaseUrl);
          const tokenHash =
            urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
          const type = urlObj.searchParams.get('type') || 'invite';
          const baseUrl =
            process.env.NEXT_PUBLIC_SITE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
          return `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;
        })()
      : null;

    // m_users テーブルにユーザー情報を登録（auth.users.id と同じIDを使用）
    const { data: newUser, error: createError } = await supabase
      .from('m_users')
      .insert({
        id: inviteData.user.id,
        company_id: company_id,
        email: body.email,
        name: body.name,
        name_kana: body.name_kana || null,
        phone: body.phone || null,
        role: body.role,
        hire_date: body.hire_date || new Date().toISOString().split('T')[0],
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      // m_users作成失敗時はauth.userも削除（ロールバック）
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      throw createError;
    }

    // 施設との紐付け
    if (targetFacilityId) {
      await supabase.from('_user_facility').insert({
        user_id: newUser.id,
        facility_id: targetFacilityId,
        start_date: newUser.hire_date,
        is_current: true,
        is_primary: true,
      });
    }

    // クラス担当設定（任意）
    if (body.assigned_classes && body.assigned_classes.length > 0) {
      const classAssignments = body.assigned_classes.map((assignment: any) => ({
        user_id: newUser.id,
        class_id: assignment.class_id,
        is_main: assignment.is_main || false,
        start_date: assignment.start_date || newUser.hire_date,
        is_current: true,
      }));

      await supabase.from('_user_class').insert(classAssignments);
    }

    // 会社名と施設名を取得してカスタムメールを送信
    try {
      if (inviteUrl) {
        const [companyResult, facilityResult] = await Promise.all([
          supabase
            .from('m_companies')
            .select('name')
            .eq('id', company_id)
            .single(),
          targetFacilityId
            ? supabase
                .from('m_facilities')
                .select('name')
                .eq('id', targetFacilityId)
                .single()
            : Promise.resolve({ data: null, error: null }),
        ]);

        const companyName = companyResult.data?.name;
        const facilityName = facilityResult.data?.name;

        // カスタム招待メールをGAS経由で送信（マジックリンク付き）
        const emailHtml = buildUserInvitationEmailHtml({
          userName: newUser.name,
          userEmail: newUser.email,
          role: newUser.role,
          companyName,
          facilityName,
          inviteUrl, // 生成されたマジックリンクを含める
        });

        await sendWithGas({
          to: newUser.email,
          subject: '【のびレコ】アカウント登録のご案内',
          htmlBody: emailHtml,
          senderName: 'のびレコ',
        });
      }

    } catch (emailError) {
      // メール送信エラーはログに記録するが、ユーザー登録自体は成功とする
      console.error('Failed to send custom invitation email:', emailError);
    }

    return NextResponse.json({
      success: true,
      data: {
        user_id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        created_at: newUser.created_at,
      },
      message: '職員アカウントを作成し、招待メールを送信しました。',
    });
  } catch (error) {
    console.error('Error creating user:', error);
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
