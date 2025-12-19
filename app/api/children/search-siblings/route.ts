import { NextRequest, NextResponse } from 'next/server';
import { getUserSession } from '@/lib/auth/session';
import { getServerSession } from '@/lib/auth/server-session';

// POST /api/children/search-siblings - 兄弟検索（電話番号ベース）
export async function POST(request: NextRequest) {
  try {
    const sessionResult = await getServerSession();
    if ('errorResponse' in sessionResult) {
      return sessionResult.errorResponse;
    }

    const { supabase, session } = sessionResult;

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const facility_id = userSession.current_facility_id;

    // リクエストボディ取得
    const body = await request.json();
    const { phone } = body;

    // バリデーション
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // 電話番号の正規化（ハイフンを削除）
    const normalizedPhone = phone.replace(/[-\s]/g, '');

    // 同じ電話番号を持つ児童を検索
    const { data: childrenData, error: childrenError } = await supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        birth_date,
        enrollment_status,
        photo_url,
        parent_phone,
        _child_class!inner (
          is_current,
          m_classes!inner (
            id,
            name,
            age_group
          )
        )
      `)
      .eq('facility_id', facility_id)
      .eq('_child_class.is_current', true)
      .is('deleted_at', null);

    if (childrenError) {
      console.error('Children search error:', childrenError);
      return NextResponse.json({ error: 'Failed to search children' }, { status: 500 });
    }

    // 電話番号でフィルタリング（parent_phoneまたはnormalized形式で一致）
    const candidates = (childrenData || []).filter((child: any) => {
      if (!child.parent_phone) return false;
      const childPhone = child.parent_phone.replace(/[-\s]/g, '');
      return childPhone === normalizedPhone;
    }).map((child: any) => {
      const classInfo = child._child_class[0]?.m_classes;

      // 年齢計算
      const birthDate = new Date(child.birth_date);
      const today = new Date();
      const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      return {
        child_id: child.id,
        name: `${child.family_name} ${child.given_name}`,
        kana: `${child.family_name_kana} ${child.given_name_kana}`,
        birth_date: child.birth_date,
        age,
        class_name: classInfo?.name || '',
        age_group: classInfo?.age_group || '',
        enrollment_status: child.enrollment_status,
        photo_url: child.photo_url,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        found: candidates.length > 0,
        candidates,
        total_found: candidates.length,
      },
    });
  } catch (error) {
    console.error('Search Siblings API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
