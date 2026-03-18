import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { sendWithGas } from '@/lib/email/gas';
import { buildUserInvitationEmailHtml } from '@/lib/email/templates';
import { getCurrentDateJST } from '@/lib/utils/timezone';
import { hasCompletedPasswordSetup } from '@/lib/auth/password-status';

interface ClassAssignmentInput {
  class_id: string;
  class_role?: string;
  is_main?: boolean;
  start_date?: string;
}

function buildClassAssignments(
  userId: string,
  assignments: ClassAssignmentInput[],
  defaultStartDate: string | null
) {
  return assignments.map((assignment) => ({
    user_id: userId,
    class_id: assignment.class_id,
    class_role:
      assignment.class_role ??
      (assignment.is_main === undefined
        ? null
        : assignment.is_main
          ? 'main'
          : 'sub'),
    start_date: assignment.start_date || defaultStartDate,
    is_current: true,
  }));
}

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

    // 検索パラメータの長さ制限
    if (search.length > 100) {
      return NextResponse.json(
        { success: false, error: '検索文字列は100文字以内で入力してください' },
        { status: 400 }
      );
    }

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

    // facility_idパラメータ（company_admin以上のみ使用可能）
    const facilityIdParam = searchParams.get('facility_id');

    // 施設フィルター
    if (role === 'site_admin') {
      // site_adminはフィルターなし（company_id でのみ絞り込み）
      // ただしfacility_idパラメータがあれば適用
      if (facilityIdParam) {
        query = query.eq('_user_facility.facility_id', facilityIdParam);
        query = query.eq('_user_facility.is_current', true);
      }
    } else if (role === 'company_admin') {
      // company_adminはfacility_idパラメータを使用可能（自社施設のみ - company_idフィルターで担保）
      const targetFacility = facilityIdParam || current_facility_id;
      if (targetFacility) {
        query = query.eq('_user_facility.facility_id', targetFacility);
        query = query.eq('_user_facility.is_current', true);
      }
    } else {
      // facility_admin: current_facility_idのみ使用（facility_idパラメータは無視）
      if (current_facility_id) {
        query = query.eq('_user_facility.facility_id', current_facility_id);
        query = query.eq('_user_facility.is_current', true);
      }
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
      const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
      query = query.or(
        `name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%,phone.ilike.%${escapedSearch}%`
      );
    }

    const { data: usersData, error: usersError } = await query.order('role').order('name');

    if (usersError) {
      throw usersError;
    }

    // 担当クラスを一括取得（N+1クエリ防止）
    const userIds = (usersData || []).map((u: { id: string }) => u.id);

    const { data: allClassAssignments } = userIds.length > 0
      ? await supabase
          .from('_user_class')
          .select(
            `
            user_id,
            class_role,
            m_classes!inner (
              id,
              name
            )
          `
          )
          .in('user_id', userIds)
          .eq('is_current', true)
      : { data: [] };

    // ユーザーごとのクラス割当マップ構築
    const classAssignmentMap = new Map<string, { class_id: string; class_name: string; is_main: boolean }[]>();
    (allClassAssignments || []).forEach((ca: { user_id: string; class_role: string | null; m_classes: { id: string; name: string } }) => {
      const entry = {
        class_id: ca.m_classes.id,
        class_name: ca.m_classes.name,
        is_main: ca.class_role === 'main',
      };
      const existing = classAssignmentMap.get(ca.user_id) || [];
      existing.push(entry);
      classAssignmentMap.set(ca.user_id, existing);
    });

    // 同期的にデータを結合
    const usersWithDetails = (usersData || []).map((u: { id: string; email: string | null; name: string; name_kana: string | null; role: string; phone: string | null; hire_date: string | null; is_active: boolean; last_login_at: string | null; created_at: string; updated_at: string }) => ({
      user_id: u.id,
      email: u.email,
      name: u.name,
      name_kana: u.name_kana,
      role: u.role,
      phone: u.phone,
      hire_date: u.hire_date,
      is_active: u.is_active,
      assigned_classes: classAssignmentMap.get(u.id) || [],
      last_login_at: u.last_login_at,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));

    // 統計情報
    const totalUsers = usersWithDetails.length;
    const activeUsers = usersWithDetails.filter((u) => u.is_active).length;
    const byRole = usersWithDetails.reduce<Record<string, number>>((acc, u) => {
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
    if (!body.name || !body.role) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: name, role' },
        { status: 400 }
      );
    }

    // メールなしスタッフ以外はメール必須
    const isEmaillessStaff = !body.email && body.role === 'staff';
    if (!body.email && !isEmaillessStaff) {
      return NextResponse.json(
        { success: false, error: 'Email is required for non-staff roles' },
        { status: 400 }
      );
    }

    // 入力値バリデーション
    const userName = String(body.name).trim();
    if (userName.length > 100) {
      return NextResponse.json(
        { success: false, error: '氏名は100文字以内で入力してください' },
        { status: 400 }
      );
    }

    if (body.email) {
      const userEmail = String(body.email).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEmail) || userEmail.length > 255) {
        return NextResponse.json(
          { success: false, error: 'メールアドレスの形式が正しくないか、255文字を超えています' },
          { status: 400 }
        );
      }
      body.email = userEmail;
    }
    body.name = userName;

    // 施設IDの決定（site_adminとcompany_adminの場合はbody.facility_idを使用可能）
    const targetFacilityId = (role === 'site_admin' || role === 'company_admin')
      ? (body.facility_id || current_facility_id)
      : current_facility_id;

    // 施設の所有権確認（クロステナントリンク防止）
    if (targetFacilityId && body.facility_id) {
      const { data: facilityCheck, error: facilityCheckError } = await supabase
        .from('m_facilities')
        .select('id')
        .eq('id', targetFacilityId)
        .eq('company_id', company_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (facilityCheckError || !facilityCheck) {
        return NextResponse.json(
          { success: false, error: 'Invalid facility_id for current company' },
          { status: 403 }
        );
      }
    }

    // ---- メールなしスタッフ登録（auth.users に登録しない） ----
    if (isEmaillessStaff) {
      const staffId = crypto.randomUUID();

      const { data: newStaff, error: createError } = await supabase
        .from('m_users')
        .insert({
          id: staffId,
          company_id: company_id,
          name: body.name,
          name_kana: body.name_kana || null,
          phone: body.phone || null,
          role: 'staff',
          hire_date: body.hire_date || getCurrentDateJST(),
          is_active: true,
          // email は NULL（個別ログインアカウントなし）
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      // 施設との紐付け
      if (targetFacilityId) {
        await supabase.from('_user_facility').insert({
          user_id: newStaff.id,
          facility_id: targetFacilityId,
          start_date: newStaff.hire_date,
          is_current: true,
          is_primary: true,
        });
      }

      // クラス担当設定（任意）
      if (body.assigned_classes && body.assigned_classes.length > 0) {
        const classAssignments = buildClassAssignments(newStaff.id, body.assigned_classes, newStaff.hire_date);
        await supabase.from('_user_class').insert(classAssignments);
      }

      return NextResponse.json({
        success: true,
        data: {
          user_id: newStaff.id,
          email: null,
          name: newStaff.name,
          role: newStaff.role,
          created_at: newStaff.created_at,
        },
        message: '職員を登録しました（ログインアカウントなし）。',
      });
    }

    // ---- メールありスタッフ登録（従来フロー: auth.users + 招待メール） ----

    // メールアドレス重複チェック
    const { data: existingUser } = await supabase
      .from('m_users')
      .select('id, name, role')
      .eq('email', body.email)
      .eq('company_id', company_id)
      .is('deleted_at', null)
      .maybeSingle();

    // Admin クライアントを作成（サービスロールキー使用）
    // ※ 再招待フローでも使い回すため、重複チェック後に宣言する
    const supabaseAdmin = await createAdminClient();

    if (existingUser) {
      // 既存ユーザーがいる場合、パスワード設定済みかどうかで処理を分岐する
      const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(existingUser.id);

      if (!authUserData?.user) {
        // Auth ユーザーが見つからない場合は通常の重複エラーとして扱う
        return NextResponse.json(
          { success: false, error: 'Email already exists' },
          { status: 400 }
        );
      }

      if (hasCompletedPasswordSetup(authUserData.user)) {
        // パスワード設定済み → 通常の重複エラー
        return NextResponse.json(
          { success: false, error: 'Email already exists' },
          { status: 400 }
        );
      }

      // パスワード未設定 → 再招待フロー
      // メールが確認済みの場合は 'invite' が失敗するため 'magiclink' を使用する
      const reinviteLinkType = authUserData.user.email_confirmed_at ? 'magiclink' : 'invite';

      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: reinviteLinkType,
        email: body.email,
      });

      if (linkError || !linkData) {
        throw linkError || new Error('Failed to generate invite link');
      }

      // Supabaseが生成したURLからトークンハッシュを抽出
      const supabaseUrl = linkData.properties.action_link;
      const urlObj = new URL(supabaseUrl);
      const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
      const type = urlObj.searchParams.get('type') || 'invite';

      if (!tokenHash) {
        console.error('Failed to extract token from invite link for re-invite, user:', existingUser.id);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to generate valid invite link',
            message: 'Token hash is missing from the generated link',
          },
          { status: 500 }
        );
      }

      // 独自のパスワード設定ページURLを構築
      const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

      // 再招待メールを送信
      sendWithGas({
        to: body.email,
        subject: '【のびレコ】アカウント登録のご案内',
        htmlBody: buildUserInvitationEmailHtml({
          userName: existingUser.name,
          userEmail: body.email,
          role: existingUser.role,
          inviteUrl,
        }),
        senderName: 'のびレコ',
      }).catch((emailError) => {
        console.error('Failed to send re-invite email:', emailError);
      });

      return NextResponse.json({
        success: true,
        message: '招待メールを再送信しました',
      });
    }

    // Supabase Auth にユーザーを作成（メール送信なし）
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: body.email,
      email_confirm: false, // メール確認は招待リンクで行う
      app_metadata: {
        role: body.role,
        company_id: company_id,
        current_facility_id: targetFacilityId || null,
      },
    });

    if (authCreateError || !authData.user) {
      throw authCreateError || new Error('Failed to create user');
    }

    // マジックリンク（招待リンク）を生成
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: body.email,
    });

    if (linkError || !linkData) {
      // ユーザー作成に失敗した場合はロールバック
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw linkError || new Error('Failed to generate invite link');
    }

    // Supabaseが生成したURLからトークンハッシュを抽出
    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const tokenHash = urlObj.searchParams.get('token_hash') || urlObj.searchParams.get('token');
    const type = urlObj.searchParams.get('type') || 'invite';

    // トークンハッシュの検証
    if (!tokenHash) {
      console.error('Failed to extract token from invite link for user creation');
      // Authユーザーをロールバック
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate valid invite link',
          message: 'Token hash is missing from the generated link',
        },
        { status: 500 }
      );
    }

    // 独自のパスワード設定ページURLを構築
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const inviteUrl = `${baseUrl}/password/setup?token_hash=${tokenHash}&type=${type}`;

    // m_users テーブルにユーザー情報を登録（auth.users.id と同じIDを使用）
    const { data: newUser, error: createError } = await supabase
      .from('m_users')
      .insert({
        id: authData.user.id,
        company_id: company_id,
        email: body.email,
        name: body.name,
        name_kana: body.name_kana || null,
        phone: body.phone || null,
        role: body.role,
        hire_date: body.hire_date || getCurrentDateJST(),
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      // m_users作成失敗時はauth.userも削除（ロールバック）
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
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
      const classAssignments = buildClassAssignments(newUser.id, body.assigned_classes, newUser.hire_date);
      await supabase.from('_user_class').insert(classAssignments);
    }

    // 会社名と施設名を取得してカスタムメールを送信
    try {
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
        inviteUrl,
      });

      sendWithGas({
        to: newUser.email,
        subject: '【のびレコ】アカウント登録のご案内',
        htmlBody: emailHtml,
        senderName: 'のびレコ',
      }).catch((emailError) => {
        console.error('Failed to send custom invitation email:', emailError);
      });
    } catch (emailError) {
      // メールHTML生成エラーはログに記録するが、ユーザー登録自体は成功とする
      console.error('Failed to prepare invitation email:', emailError);
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
