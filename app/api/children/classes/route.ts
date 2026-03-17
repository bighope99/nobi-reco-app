import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

// GET /api/children/classes - クラス一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT方式に統一）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, current_facility_id, company_id } = metadata;

    // リクエストパラメータ取得（facility_idパラメータがあればそれを使用）
    const searchParams = request.nextUrl.searchParams;
    const facilityIdParam = searchParams.get('facility_id');

    // 施設IDの決定
    // facility_admin/staffは自施設のみ（パラメータは無視）
    // site_admin/company_adminはパラメータ優先、なければJWTから
    let facility_id: string;
    if (role === 'facility_admin' || role === 'staff') {
      if (!current_facility_id) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      facility_id = current_facility_id;
    } else {
      // site_admin/company_adminのみが施設パラメータを使用可能
      if (role !== 'site_admin' && role !== 'company_admin') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      facility_id = facilityIdParam || current_facility_id || '';
      if (!facility_id) {
        return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 });
      }
      if (role === 'company_admin') {
        const { data: scopedFacility, error: scopeError } = await supabase
          .from('m_facilities')
          .select('id')
          .eq('id', facility_id)
          .eq('company_id', company_id)
          .is('deleted_at', null)
          .maybeSingle();
        if (scopeError || !scopedFacility) {
          return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    // クラス一覧取得（施設に紐づくクラス）
    const { data: classesData, error: classesError } = await supabase
      .from('m_classes')
      .select('id, name, age_group, capacity')
      .eq('facility_id', facility_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    if (classesError) {
      console.error('Classes fetch error:', classesError);
      return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
    }

    // 各クラスの在籍児童数を取得
    const classIds = (classesData || []).map((c: any) => c.id);

    let currentCount: Record<string, number> = {};

    if (classIds.length > 0) {
      const { data: classChildrenCount } = await supabase
        .from('_child_class')
        .select('class_id, child_id')
        .eq('is_current', true)
        .in('class_id', classIds);

      (classChildrenCount || []).forEach((cc: any) => {
        currentCount[cc.class_id] = (currentCount[cc.class_id] || 0) + 1;
      });
    }

    const classes = (classesData || []).map((cls: any) => ({
      class_id: cls.id,
      class_name: cls.name,
      age_group: cls.age_group || '',
      capacity: cls.capacity || 0,
      current_count: currentCount[cls.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        classes,
      },
    });
  } catch (error) {
    console.error('Children Classes API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
