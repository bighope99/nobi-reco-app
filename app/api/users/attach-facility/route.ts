import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { getCurrentDateJST } from '@/lib/utils/timezone';

/**
 * GET /api/users/attach-facility
 * 現在の施設に未所属の同会社スタッフ一覧取得
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, company_id, current_facility_id } = metadata;

    if (role === 'staff') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const targetFacilityId =
      role === 'facility_admin'
        ? current_facility_id
        : (request.nextUrl.searchParams.get('facility_id') ?? current_facility_id);

    if (!targetFacilityId) {
      return NextResponse.json(
        { success: false, error: '施設IDが指定されていません' },
        { status: 400 }
      );
    }

    // 施設が自社のものか確認（site_admin は除く）
    if (role !== 'site_admin') {
      const { data: facility, error: facilityError } = await supabase
        .from('m_facilities')
        .select('id')
        .eq('id', targetFacilityId)
        .eq('company_id', company_id)
        .single();

      if (facilityError || !facility) {
        return NextResponse.json(
          { success: false, error: 'Facility not found or access denied' },
          { status: 403 }
        );
      }
    }

    // 既に対象施設に所属しているユーザーIDを取得
    const { data: assignedRows, error: assignedError } = await supabase
      .from('_user_facility')
      .select('user_id')
      .eq('facility_id', targetFacilityId)
      .eq('is_current', true);

    if (assignedError) throw assignedError;

    const assignedUserIds = (assignedRows ?? []).map((r: { user_id: string }) => r.user_id);

    // 同会社内で未所属のスタッフを取得
    let query = supabase
      .from('m_users')
      .select('id, email, name, name_kana, role, phone, hire_date')
      .eq('company_id', company_id)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('name');

    if (assignedUserIds.length > 0) {
      query = query.not('id', 'in', `(${assignedUserIds.join(',')})`);
    }

    const { data: availableUsers, error: usersError } = await query;

    if (usersError) throw usersError;

    return NextResponse.json({
      success: true,
      data: {
        users: (availableUsers ?? []).map((u) => ({
          user_id: u.id,
          email: u.email,
          name: u.name,
          name_kana: u.name_kana,
          role: u.role,
          phone: u.phone,
          hire_date: u.hire_date,
        })),
        facility_id: targetFacilityId,
      },
    });
  } catch (error) {
    console.error('Error fetching available users:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/attach-facility
 * 既存スタッフを現在の施設に追加
 * body: { user_ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, company_id, current_facility_id } = metadata;

    if (role === 'staff') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { user_ids, facility_id: facilityIdParam } = body as {
      user_ids: string[];
      facility_id?: string;
    };

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'user_ids は1件以上指定してください' },
        { status: 400 }
      );
    }

    const targetFacilityId =
      role === 'facility_admin' ? current_facility_id : (facilityIdParam ?? current_facility_id);

    if (!targetFacilityId) {
      return NextResponse.json(
        { success: false, error: '施設IDが指定されていません' },
        { status: 400 }
      );
    }

    // 施設が自社のものか確認（site_admin は除く）
    if (role !== 'site_admin') {
      const { data: facility, error: facilityError } = await supabase
        .from('m_facilities')
        .select('id')
        .eq('id', targetFacilityId)
        .eq('company_id', company_id)
        .single();

      if (facilityError || !facility) {
        return NextResponse.json(
          { success: false, error: 'Facility not found or access denied' },
          { status: 403 }
        );
      }
    }

    // 対象ユーザーが同会社に所属していることを確認
    const { data: validUsers, error: validateError } = await supabase
      .from('m_users')
      .select('id')
      .eq('company_id', company_id)
      .is('deleted_at', null)
      .in('id', user_ids);

    if (validateError) throw validateError;

    const validUserIds = (validUsers ?? []).map((u: { id: string }) => u.id);
    if (validUserIds.length !== user_ids.length) {
      return NextResponse.json(
        { success: false, error: '一部のユーザーが見つかりません' },
        { status: 400 }
      );
    }

    const today = getCurrentDateJST();
    const records = validUserIds.map((userId: string) => ({
      user_id: userId,
      facility_id: targetFacilityId,
      is_current: true,
      is_primary: false,
      start_date: today,
    }));

    const { error: insertError } = await supabase.from('_user_facility').insert(records);

    if (insertError) {
      // UNIQUE 制約違反: 既に所属済み
      if (insertError.code === '23505') {
        return NextResponse.json(
          { success: false, error: '既にこの施設に所属しているスタッフが含まれています' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      data: { added_count: validUserIds.length, facility_id: targetFacilityId },
      message: `${validUserIds.length}名のスタッフをこの施設に追加しました`,
    });
  } catch (error) {
    console.error('Error attaching users to facility:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
