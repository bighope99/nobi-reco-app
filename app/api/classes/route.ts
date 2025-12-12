import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/classes
 * クラス一覧取得
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

    // リクエストパラメータ取得
    const searchParams = request.nextUrl.searchParams;
    const facilityId = searchParams.get('facility_id');
    const search = searchParams.get('search') || '';

    // クラス一覧取得クエリ
    let query = supabase
      .from('m_classes')
      .select(
        `
        id,
        name,
        grade,
        school_year,
        capacity,
        is_active,
        facility_id,
        m_facilities!inner (
          id,
          name,
          company_id
        ),
        created_at,
        updated_at
      `
      )
      .is('deleted_at', null);

    // 施設フィルタ
    if (facilityId) {
      query = query.eq('facility_id', facilityId);
    }

    // 権限に応じたフィルタ
    if (userData.role === 'company_admin') {
      query = query.eq('m_facilities.company_id', userData.company_id);
    } else if (
      userData.role === 'facility_admin' ||
      userData.role === 'staff'
    ) {
      // 自分が所属する施設のクラスのみ
      const { data: userFacilities } = await supabase
        .from('_user_facility')
        .select('facility_id')
        .eq('user_id', user.id)
        .eq('is_primary', true);

      if (userFacilities && userFacilities.length > 0) {
        const facilityIds = userFacilities.map((uf) => uf.facility_id);
        if (!facilityId) {
          query = query.in('facility_id', facilityIds);
        } else if (!facilityIds.includes(facilityId)) {
          // 指定された施設IDに権限がない場合
          return NextResponse.json({
            success: true,
            data: {
              classes: [],
              total: 0,
              total_children: 0,
              total_capacity: 0,
            },
          });
        }
      } else {
        return NextResponse.json({
          success: true,
          data: {
            classes: [],
            total: 0,
            total_children: 0,
            total_capacity: 0,
          },
        });
      }
    }

    const { data: classes, error: classesError } = await query.order(
      'name',
      { ascending: true }
    );

    if (classesError) {
      throw classesError;
    }

    // 各クラスの統計情報と担任リストを取得
    const classesWithDetails = await Promise.all(
      (classes || []).map(async (cls: any) => {
        // 在籍児童数
        const { count: currentCount } = await supabase
          .from('_child_class')
          .select('child_id', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('is_current', true);

        // 担当職員数
        const { count: staffCount } = await supabase
          .from('_user_class')
          .select('user_id', { count: 'exact', head: true })
          .eq('class_id', cls.id);

        // 担任リスト取得
        const { data: teachers } = await supabase
          .from('_user_class')
          .select(
            `
            is_homeroom,
            m_users!inner (
              name
            )
          `
          )
          .eq('class_id', cls.id)
          .order('is_homeroom', { ascending: false });

        const teacherNames =
          teachers?.map((t: any) => t.m_users.name) || [];

        return {
          class_id: cls.id,
          name: cls.name,
          facility_id: cls.facility_id,
          facility_name: cls.m_facilities.name,
          grade: cls.grade,
          school_year: cls.school_year,
          capacity: cls.capacity,
          current_count: currentCount || 0,
          staff_count: staffCount || 0,
          teachers: teacherNames,
          is_active: cls.is_active,
          created_at: cls.created_at,
          updated_at: cls.updated_at,
        };
      })
    );

    // 検索フィルタ（クライアント側）
    let filteredClasses = classesWithDetails;
    if (search) {
      filteredClasses = classesWithDetails.filter(
        (cls) =>
          cls.name.includes(search) ||
          cls.teachers.some((teacher) => teacher.includes(search))
      );
    }

    // 統計情報
    const totalChildren = filteredClasses.reduce(
      (sum, cls) => sum + cls.current_count,
      0
    );
    const totalCapacity = filteredClasses.reduce(
      (sum, cls) => sum + cls.capacity,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        classes: filteredClasses,
        total: filteredClasses.length,
        total_children: totalChildren,
        total_capacity: totalCapacity,
      },
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
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
 * POST /api/classes
 * クラス新規作成
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

    const body = await request.json();

    // 必須パラメータチェック
    if (!body.facility_id || !body.name || !body.capacity || !body.school_year) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // クラス作成
    const { data: newClass, error: createError } = await supabase
      .from('m_classes')
      .insert({
        facility_id: body.facility_id,
        name: body.name,
        grade: body.grade,
        school_year: body.school_year,
        capacity: body.capacity,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return NextResponse.json({
      success: true,
      data: {
        class_id: newClass.id,
        name: newClass.name,
        grade: newClass.grade,
        school_year: newClass.school_year,
        capacity: newClass.capacity,
        current_count: 0,
        created_at: newClass.created_at,
      },
      message: 'クラスを作成しました',
    });
  } catch (error) {
    console.error('Error creating class:', error);
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
