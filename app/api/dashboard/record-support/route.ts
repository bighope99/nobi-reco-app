import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { formatName } from '@/utils/crypto/decryption-helper';
import { cachedBatchDecryptChildren } from '@/utils/crypto/decryption-cache';
import { getCurrentDateJST, toDateStringJST } from '@/lib/utils/timezone';

/**
 * Record Support API
 *
 * 記録サポート候補を返すエンドポイント
 * - 7日以上記録がない児童
 * - 週間記録が2件未満の児童
 *
 * ダッシュボード表示後に非同期で取得される
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const facility_id = userSession.current_facility_id;

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : getCurrentDateJST();

    const classIdParam = searchParams.get('class_id');
    const class_id =
      classIdParam &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classIdParam)
        ? classIdParam
        : null;

    // 1. 子ども一覧取得（最小限のフィールド）
    let childrenQuery = supabase
      .from('m_children')
      .select(
        `
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        _child_class (
          class_id,
          is_current,
          m_classes (
            id,
            name
          )
        )
      `
      )
      .eq('facility_id', facility_id)
      .eq('enrollment_status', 'enrolled')
      .eq('_child_class.is_current', true)
      .is('deleted_at', null);

    if (class_id) {
      childrenQuery = childrenQuery.eq('_child_class.class_id', class_id);
    }

    const { data: childrenDataRaw, error: childrenError } = await childrenQuery;

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    const childrenData = childrenDataRaw ?? [];
    const childIds = childrenData.map((c: any) => c.id);

    if (childIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          record_support: [],
        },
      });
    }

    // 2. 週間記録数計算用の日付
    const oneWeekAgo = new Date(date);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = toDateStringJST(oneWeekAgo);

    // 3. 記録情報を取得
    const { data: observationsData, error: observationsError } = await supabase
      .from('r_observation')
      .select('child_id, observation_date')
      .in('child_id', childIds)
      .gte('observation_date', oneWeekAgoStr)
      .is('deleted_at', null);

    if (observationsError) {
      console.error('Observations fetch error:', observationsError);
      return NextResponse.json({ error: 'Failed to fetch observations' }, { status: 500 });
    }

    // 4. 記録情報をグループ化
    const observationsMap = new Map<string, any[]>();
    for (const obs of observationsData || []) {
      const existing = observationsMap.get(obs.child_id) || [];
      existing.push(obs);
      observationsMap.set(obs.child_id, existing);
    }

    // 5. 記録サポート候補を抽出
    const getDaysDiff = (date1: string, date2: string | null) => {
      if (!date2) return 999;
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    };

    const candidateChildren: any[] = [];
    const candidateData: Array<{
      lastRecordDate: string | null;
      daysSince: number;
      weeklyRecordCount: number;
    }> = [];

    for (const child of childrenData) {
      const childObservations = observationsMap.get(child.id) || [];
      const lastRecordDate =
        childObservations.length > 0
          ? childObservations.sort((a: any, b: any) =>
              b.observation_date.localeCompare(a.observation_date)
            )[0].observation_date
          : null;
      const weeklyRecordCount = childObservations.length;
      const daysSince = getDaysDiff(date, lastRecordDate);

      // 7日以上未記録、または週間記録2件未満
      if (daysSince >= 7 || weeklyRecordCount < 2) {
        candidateChildren.push(child);
        candidateData.push({ lastRecordDate, daysSince, weeklyRecordCount });
      }
    }

    // 6. 候補児童のみバッチ復号化 - 施設IDでキャッシュ分離
    const decryptedCandidates = cachedBatchDecryptChildren(candidateChildren, facility_id);

    // 7. 記録サポートリスト構築
    type RecordSupportItem = {
      child_id: string;
      name: string;
      kana: string;
      class_name: string;
      last_record_date: string | null;
      days_since_record: number;
      weekly_record_count: number;
      reason: string;
    };

    const recordSupport: RecordSupportItem[] = decryptedCandidates.map((child: any, index: number) => {
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classInfo = currentClass?.m_classes;
      const { lastRecordDate, daysSince, weeklyRecordCount } = candidateData[index];

      let reason = '';
      if (daysSince >= 7) {
        reason = `${daysSince}日間未記録`;
      } else if (weeklyRecordCount < 2) {
        reason = '週間記録が少ない';
      }

      return {
        child_id: child.id,
        name: formatName([child.decrypted_family_name, child.decrypted_given_name]) ?? '',
        kana: formatName([child.decrypted_family_name_kana, child.decrypted_given_name_kana]) ?? '',
        class_name: classInfo?.name || '',
        last_record_date: lastRecordDate,
        days_since_record: daysSince,
        weekly_record_count: weeklyRecordCount,
        reason,
      };
    });

    // 優先度順にソート（未記録日数が多い順）
    recordSupport.sort((a, b) => b.days_since_record - a.days_since_record);

    return NextResponse.json({
      success: true,
      data: {
        record_support: recordSupport,
      },
    });
  } catch (error) {
    console.error('Record Support API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
