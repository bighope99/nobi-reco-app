import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/users
 * 職員一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ユーザー情報取得
    const { data: userData, error: userError } = await supabase
      .from('m_users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 権限チェック（staffは閲覧不可）
    if (userData.role === 'staff') {
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

    // セッションから現在の施設IDを取得
    const { data: userFacility } = await supabase
      .from('_user_facility')
      .select('facility_id')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .single();

    if (!userFacility) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
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
      .is('deleted_at', null);

    // 施設フィルター
    query = query.eq('_user_facility.facility_id', userFacility.facility_id);
    query = query.eq('_user_facility.is_current', true);

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

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ユーザー情報取得
    const { data: userData } = await supabase
      .from('m_users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 権限チェック（staffは作成不可）
    if (userData.role === 'staff') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // セッションから現在の施設IDを取得
    const { data: userFacility } = await supabase
      .from('_user_facility')
      .select('facility_id')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .single();

    if (!userFacility) {
      return NextResponse.json(
        { success: false, error: 'Facility not found' },
        { status: 404 }
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

    // 初期パスワード生成（または使用）
    const initialPassword = body.initial_password || generatePassword();

    // ユーザー作成
    const { data: newUser, error: createError } = await supabase
      .from('m_users')
      .insert({
        company_id: userData.company_id,
        email: body.email,
        name: body.name,
        name_kana: body.name_kana || null,
        phone: body.phone || null,
        birth_date: body.birth_date || null,
        role: body.role,
        hire_date: body.hire_date || new Date().toISOString().split('T')[0],
        position: body.position || null,
        employment_type: body.employment_type || 'full_time',
        qualifications: body.qualifications || [],
        is_active: true,
        password_reset_required: true,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    // 施設との紐付け
    await supabase.from('_user_facility').insert({
      user_id: newUser.id,
      facility_id: userFacility.facility_id,
      start_date: newUser.hire_date,
      is_current: true,
    });

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

    return NextResponse.json({
      success: true,
      data: {
        user_id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        initial_password: initialPassword,
        password_reset_required: true,
        created_at: newUser.created_at,
      },
      message: '職員アカウントを作成しました。初回ログイン時にパスワード変更が必要です。',
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

// パスワード生成ヘルパー
function generatePassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}
