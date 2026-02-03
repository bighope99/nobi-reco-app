import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { getCurrentDateJST, getFirstDayOfMonthJST, getLastDayOfMonthJST, isoToDateJST } from '@/lib/utils/timezone';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const facility_id = metadata.current_facility_id;

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const class_id = searchParams.get('class_id') || null;
    const search = searchParams.get('search') || null;
    const warning_only = searchParams.get('warning_only') === 'true';

    // バリデーション
    if (year < 1900 || year > 2100 || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }

    // 期間計算（JSTベース）
    const startDateStr = getFirstDayOfMonthJST(year, month);
    const endDateStr = getLastDayOfMonthJST(year, month);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 年初
    const yearStartStr = `${year}-01-01`;
    const today = getCurrentDateJST();

    // 1. 子ども一覧取得
    let childrenQuery = supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        birth_date,
        grade_add,
        photo_url,
        _child_class (
          class_id,
          is_current,
          m_classes (
            id,
            name,
            age_group
          )
        )
      `)
      .eq('facility_id', facility_id)
      .eq('enrollment_status', 'enrolled')
      .is('deleted_at', null);

    if (class_id) {
      childrenQuery = childrenQuery.eq('_child_class.class_id', class_id);
    }

    if (search) {
      childrenQuery = childrenQuery.or(`family_name.ilike.%${search}%,given_name.ilike.%${search}%,family_name_kana.ilike.%${search}%,given_name_kana.ilike.%${search}%`);
    }

    const { data: childrenData, error: childrenError } = await childrenQuery;

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    if (!childrenData || childrenData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period: {
            year,
            month,
            start_date: startDateStr,
            end_date: endDateStr,
            days_in_month: daysInMonth,
          },
          children: [],
          summary: {
            total_children: 0,
            warning_children: 0,
            average_record_rate: 0,
          },
          filters: {
            classes: [],
          },
        },
      });
    }

    const childIds = childrenData.map((c: any) => c.id);

    // 2-6. データ取得（並列実行で高速化）
    const [
      { data: monthlyAttendanceData, error: monthlyAttError },
      { data: monthlyObservationsData, error: monthlyObsError },
      { data: yearlyAttendanceData, error: yearlyAttError },
      { data: yearlyObservationsData, error: yearlyObsError },
      { data: allTimeLastRecordsData, error: allTimeLastRecordsError },
    ] = await Promise.all([
      // 月間出席ログ
      supabase
        .from('h_attendance')
        .select('child_id, checked_in_at, checked_out_at')
        .in('child_id', childIds)
        .gte('checked_in_at', `${startDateStr}T00:00:00+09:00`)
        .lte('checked_in_at', `${endDateStr}T23:59:59.999+09:00`),

      // 月間記録
      supabase
        .from('r_observation')
        .select('child_id, observation_date')
        .in('child_id', childIds)
        .gte('observation_date', startDateStr)
        .lte('observation_date', endDateStr)
        .is('deleted_at', null),

      // 年間出席ログ
      supabase
        .from('h_attendance')
        .select('child_id, checked_in_at')
        .in('child_id', childIds)
        .gte('checked_in_at', `${yearStartStr}T00:00:00+09:00`)
        .lte('checked_in_at', `${today}T23:59:59.999+09:00`),

      // 年間記録
      supabase
        .from('r_observation')
        .select('child_id, observation_date')
        .in('child_id', childIds)
        .gte('observation_date', yearStartStr)
        .lte('observation_date', today)
        .is('deleted_at', null),

      // 全期間の最終記録日（月をまたいでも継続表示するため）
      supabase
        .from('r_observation')
        .select('child_id, observation_date')
        .in('child_id', childIds)
        .is('deleted_at', null)
        .order('observation_date', { ascending: false }),
    ]);

    // エラーチェック
    if (monthlyAttError || monthlyObsError || yearlyAttError || yearlyObsError || allTimeLastRecordsError) {
      console.error('Data fetch errors:', {
        monthlyAttError,
        monthlyObsError,
        yearlyAttError,
        yearlyObsError,
        allTimeLastRecordsError,
      });
      return NextResponse.json(
        { error: 'Failed to fetch status data' },
        { status: 500 },
      );
    }

    // データをchild_idでグループ化（O(n²) → O(n)への最適化）
    const monthlyAttendancesByChild = new Map<string, any[]>();
    (monthlyAttendanceData || []).forEach((a) => {
      if (!monthlyAttendancesByChild.has(a.child_id)) {
        monthlyAttendancesByChild.set(a.child_id, []);
      }
      monthlyAttendancesByChild.get(a.child_id)!.push(a);
    });

    const monthlyObservationsByChild = new Map<string, any[]>();
    (monthlyObservationsData || []).forEach((o) => {
      if (!monthlyObservationsByChild.has(o.child_id)) {
        monthlyObservationsByChild.set(o.child_id, []);
      }
      monthlyObservationsByChild.get(o.child_id)!.push(o);
    });

    const yearlyAttendancesByChild = new Map<string, any[]>();
    (yearlyAttendanceData || []).forEach((a) => {
      if (!yearlyAttendancesByChild.has(a.child_id)) {
        yearlyAttendancesByChild.set(a.child_id, []);
      }
      yearlyAttendancesByChild.get(a.child_id)!.push(a);
    });

    const yearlyObservationsByChild = new Map<string, any[]>();
    (yearlyObservationsData || []).forEach((o) => {
      if (!yearlyObservationsByChild.has(o.child_id)) {
        yearlyObservationsByChild.set(o.child_id, []);
      }
      yearlyObservationsByChild.get(o.child_id)!.push(o);
    });

    // 全期間の最終記録日（child_id -> 最新の observation_date）
    // データは observation_date 降順でソート済みなので、最初の1件が最新
    const allTimeLastRecordByChild = new Map<string, string>();
    (allTimeLastRecordsData || []).forEach((o) => {
      if (!allTimeLastRecordByChild.has(o.child_id)) {
        allTimeLastRecordByChild.set(o.child_id, o.observation_date);
      }
    });

    // データ整形
    const children = childrenData.map((child: any) => {
      // 現在所属中のクラスのみを取得
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classInfo = currentClass?.m_classes;

      const grade = calculateGrade(child.birth_date, child.grade_add);
      const gradeLabel = formatGradeLabel(grade);

      // 月間統計（Mapから O(1) で取得）
      const monthlyAttendances = monthlyAttendancesByChild.get(child.id) || [];
      const monthlyAttendanceDates = new Set(
        monthlyAttendances.map((a: any) => isoToDateJST(a.checked_in_at))
      );
      const monthlyAttendanceCount = monthlyAttendanceDates.size;

      const monthlyObservations = monthlyObservationsByChild.get(child.id) || [];
      const monthlyObservationDates = new Set(monthlyObservations.map((o: any) => o.observation_date));
      const monthlyRecordCount = monthlyObservationDates.size;

      const monthlyRecordRate = monthlyAttendanceCount > 0
        ? Math.round((monthlyRecordCount / monthlyAttendanceCount) * 100 * 10) / 10
        : 0;

      // 最終記録日（全期間 - 月をまたいでも継続表示）
      const lastRecordDate = allTimeLastRecordByChild.get(child.id) || null;

      const isRecordedToday = lastRecordDate === today;

      // 日別記録ステータス（1日〜月末）
      const dailyStatus: string[] = [];
      const monthStr = String(month).padStart(2, '0');
      for (let day = 1; day <= daysInMonth; day++) {
        // 文字列を直接構築（サーバータイムゾーン非依存）
        const dateStr = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
        const isAttended = monthlyAttendanceDates.has(dateStr);
        const isRecorded = monthlyObservationDates.has(dateStr);

        if (isRecorded && isAttended) {
          dailyStatus.push('present');
        } else if (isAttended && !isRecorded) {
          dailyStatus.push('late');
        } else if (!isAttended) {
          dailyStatus.push('absent');
        } else {
          dailyStatus.push('none');
        }
      }

      // 年間統計（Mapから O(1) で取得）
      const yearlyAttendances = yearlyAttendancesByChild.get(child.id) || [];
      const yearlyAttendanceDates = new Set(
        yearlyAttendances.map((a: any) => isoToDateJST(a.checked_in_at))
      );
      const yearlyAttendanceCount = yearlyAttendanceDates.size;

      const yearlyObservations = yearlyObservationsByChild.get(child.id) || [];
      const yearlyObservationDates = new Set(yearlyObservations.map((o: any) => o.observation_date));
      const yearlyRecordCount = yearlyObservationDates.size;

      const yearlyRecordRate = yearlyAttendanceCount > 0
        ? Math.round((yearlyRecordCount / yearlyAttendanceCount) * 100 * 10) / 10
        : 0;

      // PIIフィールドを復号化
      const decryptedFamilyName = decryptOrFallback(child.family_name);
      const decryptedGivenName = decryptOrFallback(child.given_name);
      const decryptedFamilyNameKana = decryptOrFallback(child.family_name_kana);
      const decryptedGivenNameKana = decryptOrFallback(child.given_name_kana);

      return {
        child_id: child.id,
        name: formatName([decryptedFamilyName, decryptedGivenName]),
        kana: formatName([decryptedFamilyNameKana, decryptedGivenNameKana]),
        class_id: classInfo?.id || null,
        class_name: classInfo?.name || '',
        age_group: classInfo?.age_group || '',
        grade,
        grade_label: gradeLabel,
        photo_url: child.photo_url,
        last_record_date: lastRecordDate,
        is_recorded_today: isRecordedToday,
        monthly: {
          attendance_count: monthlyAttendanceCount,
          record_count: monthlyRecordCount,
          record_rate: monthlyRecordRate,
          daily_status: dailyStatus,
        },
        yearly: {
          attendance_count: yearlyAttendanceCount,
          record_count: yearlyRecordCount,
          record_rate: yearlyRecordRate,
        },
      };
    });

    // warning_onlyフィルター適用
    const filteredChildren = warning_only
      ? children.filter(c => c.monthly.record_rate < 80)
      : children;

    // サマリー計算
    const warningChildren = children.filter(c => c.monthly.record_rate < 80).length;
    const averageRecordRate = children.length > 0
      ? Math.round((children.reduce((sum, c) => sum + c.monthly.record_rate, 0) / children.length) * 10) / 10
      : 0;

    // クラス一覧（フィルター用）
    const { data: classesData } = await supabase
      .from('m_classes')
      .select('id, name')
      .eq('facility_id', facility_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    const filters = {
      classes: (classesData || []).map((cls: any) => ({
        class_id: cls.id,
        class_name: cls.name,
      })),
    };

    // レスポンス構築
    const response = {
      success: true,
      data: {
        period: {
          year,
          month,
          start_date: startDateStr,
          end_date: endDateStr,
          days_in_month: daysInMonth,
        },
        children: filteredChildren,
        summary: {
          total_children: children.length,
          warning_children: warningChildren,
          average_record_rate: averageRecordRate,
        },
        filters,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Records Status API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
