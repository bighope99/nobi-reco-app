import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';

// GET /api/children/classes - クラス一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const facility_id = userSession.current_facility_id;

    // クラス一覧取得（施設に紐づくクラス）
    const { data: classesData, error: classesError } = await supabase
      .from('m_classes')
      .select('id, name, grade, capacity')
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
      age_group: cls.grade || '',
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
