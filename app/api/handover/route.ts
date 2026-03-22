import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';

/**
 * GET /api/handover
 *
 * バナー用API: 指定日より前の最新のhandoverを取得
 *
 * Query Parameters:
 * - date (required): 基準日（YYYY-MM-DD形式）
 * - class_id (optional): クラスID（指定した場合は特定クラスのみ）
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     handover_date: "2026-02-24",
 *     has_next_record: false,
 *     items: [
 *       {
 *         activity_id: "...",
 *         handover: "...",
 *         handover_completed: false,
 *         class_name: "...",
 *         created_by_name: "..."
 *       }
 *     ]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 認証チェック
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const facility_id = metadata.current_facility_id;
    const date = searchParams.get('date');
    const class_id = searchParams.get('class_id');

    // date パラメータは必須
    if (!date) {
      return NextResponse.json(
        { success: false, error: 'date parameter is required' },
        { status: 400 }
      );
    }

    // 日付形式の簡易バリデーション（YYYY-MM-DD）
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // 日付の妥当性チェック（2026-99-99のような無効日付を拒否）
    const parsedDate = new Date(date + 'T00:00:00Z');
    if (isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      return NextResponse.json(
        { success: false, error: 'Invalid date value' },
        { status: 400 }
      );
    }

    // class_id のバリデーション
    if (class_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(class_id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid class_id format' },
          { status: 400 }
        );
      }
    }

    // class_id の施設所属チェック
    if (class_id) {
      const { data: classData, error: classError } = await supabase
        .from('m_classes')
        .select('id')
        .eq('id', class_id)
        .eq('facility_id', facility_id)
        .is('deleted_at', null)
        .single();

      if (classError || !classData) {
        return NextResponse.json(
          { success: false, error: 'Invalid class_id or class does not belong to this facility' },
          { status: 400 }
        );
      }
    }

    // handover が存在する最新の活動を検索（1クエリで完結）
    let query = supabase
      .from('r_activity')
      .select(`
        id,
        activity_date,
        handover,
        handover_completed,
        class_id,
        m_classes (
          id,
          name
        ),
        m_users!r_activity_created_by_fkey (
          id,
          name
        )
      `)
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .lt('activity_date', date)
      .not('handover', 'is', null)
      .neq('handover', '')
      .order('activity_date', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(20);

    if (class_id) {
      query = query.eq('class_id', class_id);
    }

    const { data: activities, error: activitiesError } = await query;

    if (activitiesError) {
      console.error('Database error:', activitiesError);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          handover_date: null,
          items: [],
        },
      });
    }

    // アプリケーション層で最新日付のデータのみ抽出
    const handover_date = activities[0].activity_date;
    const latestActivities = activities.filter(a => a.activity_date === handover_date);

    // 引き継ぎ日以降（引き継ぎ日を含まない）に次の記録があるかチェック
    // class_id指定時は同クラスの記録のみ対象
    let nextRecordQuery = supabase
      .from('r_activity')
      .select('id', { count: 'exact', head: true })
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .gt('activity_date', handover_date)
      .lt('activity_date', date);

    if (class_id) {
      nextRecordQuery = nextRecordQuery.eq('class_id', class_id);
    }

    const { count: nextRecordCount } = await nextRecordQuery;
    const has_next_record = (nextRecordCount ?? 0) > 0;

    const items = latestActivities.map((activity) => {
      const classData = Array.isArray(activity.m_classes) ? activity.m_classes[0] : activity.m_classes;
      const userData = Array.isArray(activity.m_users) ? activity.m_users[0] : activity.m_users;
      return {
        activity_id: activity.id,
        handover: activity.handover,
        handover_completed: activity.handover_completed ?? false,
        class_name: classData?.name || '',
        created_by_name: userData?.name || '',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        handover_date,
        has_next_record,
        items,
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
