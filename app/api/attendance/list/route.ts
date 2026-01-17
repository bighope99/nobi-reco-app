import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { fetchAttendanceContext, isScheduledForDate, weekdayJpMap } from '../utils/attendance';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { getCurrentDateJST } from '@/lib/utils/timezone';

/**
 * 検索パラメータのサニタイズ
 * PostgRESTの特殊文字を除去してSQLインジェクション的な攻撃を防ぐ
 */
const sanitizeSearchInput = (input: string): string => {
  return input
    .replace(/[%_,.*()]/g, '') // PostgREST特殊文字を除去
    .trim()
    .substring(0, 100); // 長さ制限
};

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
    const dateParam = searchParams.get('date');
    const class_id = searchParams.get('class_id');
    const statusFilter = searchParams.get('status');
    const search = searchParams.get('search');

    // 対象日（デフォルトは今日）
    const targetDate = dateParam || getCurrentDateJST();

    // 児童一覧を取得
    let childrenQuery = supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        photo_url,
        birth_date,
        grade_add,
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
      .eq('_child_class.is_current', true)
      .is('deleted_at', null);

    if (class_id) {
      childrenQuery = childrenQuery.eq('_child_class.class_id', class_id);
    }

    if (search) {
      const sanitized = sanitizeSearchInput(search);
      if (sanitized) {
        childrenQuery = childrenQuery.or(`family_name.ilike.%${sanitized}%,given_name.ilike.%${sanitized}%,family_name_kana.ilike.%${sanitized}%,given_name_kana.ilike.%${sanitized}%`);
      }
    }

    const { data: childrenRaw, error: childrenError } = await childrenQuery;

    if (childrenError) {
      console.error('Database error:', childrenError);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    const children = childrenRaw ?? [];

    // スケジュール・当日設定・出席実績を共通ロジックで取得
    const { dayOfWeekKey, schedulePatterns, dailyAttendanceData, attendanceLogsData } = await fetchAttendanceContext(
      supabase,
      facility_id,
      targetDate,
      children.map((c: any) => c.id)
    );

    const weekday = dayOfWeekKey;

    const attendanceMap = new Map();
    attendanceLogsData.forEach((record: any) => {
      const existing = attendanceMap.get(record.child_id);
      if (!existing) {
        attendanceMap.set(record.child_id, record);
        return;
      }

      if (existing.checked_in_at && record.checked_in_at) {
        const existingTime = new Date(existing.checked_in_at).getTime();
        const currentTime = new Date(record.checked_in_at).getTime();

        if (currentTime < existingTime) {
          attendanceMap.set(record.child_id, record);
        }

        return;
      }

      if (!existing.checked_in_at && record.checked_in_at) {
        attendanceMap.set(record.child_id, record);
      }
    });

    const formattedChildren = children.map((child: any) => {
      // 現在所属中のクラスのみを取得
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classData = currentClass?.m_classes;
      const schedulePattern = (schedulePatterns || []).find((schedule: any) => schedule.child_id === child.id);
      const dailyRecord = (dailyAttendanceData || []).find((record: any) => record.child_id === child.id);
      const isExpected = isScheduledForDate(schedulePattern, dailyRecord, dayOfWeekKey);
      const isMarkedAbsent = dailyRecord?.status === 'absent';
      const attendance = attendanceMap.get(child.id);

      const grade = calculateGrade(child.birth_date, child.grade_add);
      const gradeLabel = formatGradeLabel(grade);

      // ステータス判定
      let status = 'not_arrived';
      let isUnexpected = false;

      if (attendance?.checked_in_at) {
        const checkedInTime = new Date(attendance.checked_in_at);
        const hour = checkedInTime.getHours();
        const minute = checkedInTime.getMinutes();

        // 9:30以降をチェックイン遅刻とみなす
        if (hour > 9 || (hour === 9 && minute >= 30)) {
          status = 'late';
        } else {
          status = 'present';
        }

        // 予定外チェック
        if (!isExpected) {
          isUnexpected = true;
        }
      } else if (isExpected) {
        status = 'absent';
      } else if (isMarkedAbsent) {
        status = 'absent';
      }

      // PIIフィールドを復号化
      const decryptedFamilyName = decryptOrFallback(child.family_name);
      const decryptedGivenName = decryptOrFallback(child.given_name);
      const decryptedFamilyNameKana = decryptOrFallback(child.family_name_kana);
      const decryptedGivenNameKana = decryptOrFallback(child.given_name_kana);

      return {
        child_id: child.id,
        name: formatName([decryptedFamilyName, decryptedGivenName]),
        kana: formatName([decryptedFamilyNameKana, decryptedGivenNameKana]),
        class_id: classData?.id || null,
        class_name: classData?.name || '',
        age_group: classData?.age_group || '',
        grade,
        grade_label: gradeLabel,
        photo_url: child.photo_url,
        status,
        is_expected: isExpected,
        checked_in_at: attendance?.checked_in_at || null,
        checked_out_at: attendance?.checked_out_at || null,
        check_in_method: attendance?.check_in_method || null,
        is_unexpected: isUnexpected,
      };
    });

    // ステータスフィルター適用
    let filteredChildren = formattedChildren;
    if (statusFilter) {
      filteredChildren = formattedChildren.filter((child: any) => child.status === statusFilter);
    }

    // サマリー計算
    const summary = {
      total_children: formattedChildren.length,
      present_count: formattedChildren.filter((c: any) => c.status === 'present').length,
      absent_count: formattedChildren.filter((c: any) => c.status === 'absent').length,
      late_count: formattedChildren.filter((c: any) => c.status === 'late').length,
      not_checked_in_count: formattedChildren.filter((c: any) => c.status === 'not_arrived' && c.is_expected).length,
    };

    // クラス一覧を取得
    const { data: classes } = await supabase
      .from('m_classes')
      .select('id, name')
      .eq('facility_id', facility_id)
      .is('deleted_at', null)
      .order('display_order');

    const classesWithCounts = (classes || []).map((cls: any) => {
      const classChildren = formattedChildren.filter((c: any) => c.class_id === cls.id);
      return {
        class_id: cls.id,
        class_name: cls.name,
        present_count: classChildren.filter((c: any) => c.status === 'present').length,
        total_count: classChildren.length,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate,
        weekday,
        weekday_jp: weekdayJpMap[weekday],
        summary,
        children: filteredChildren,
        filters: {
          classes: classesWithCounts,
        },
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
