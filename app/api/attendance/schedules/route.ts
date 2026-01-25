import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { current_facility_id: facility_id } = metadata;
    if (!facility_id) {
      return NextResponse.json(
        { success: false, error: 'Facility not found in session' },
        { status: 400 }
      );
    }
    const class_id = searchParams.get('class_id');
    const search = searchParams.get('search');

    // 児童の出席予定パターンを取得
    let query = supabase
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
        ),
        s_attendance_schedule (
          monday,
          tuesday,
          wednesday,
          thursday,
          friday,
          saturday,
          sunday,
          updated_at
        )
      `)
      .eq('facility_id', facility_id)
      .eq('enrollment_status', 'enrolled')
      .is('deleted_at', null);

    // クラスフィルター
    if (class_id) {
      query = query.eq('_child_class.class_id', class_id);
    }

    // 検索フィルター
    if (search) {
      query = query.or(`family_name.ilike.%${search}%,given_name.ilike.%${search}%,family_name_kana.ilike.%${search}%,given_name_kana.ilike.%${search}%`);
    }

    const { data: children, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    // データを整形
    const formattedChildren = children.map((child: any) => {
      // 現在所属中のクラスのみを取得
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classData = currentClass?.m_classes;
      const schedule = Array.isArray(child.s_attendance_schedule) && child.s_attendance_schedule.length > 0
        ? child.s_attendance_schedule[0]
        : null;

      const grade = calculateGrade(child.birth_date, child.grade_add);
      const gradeLabel = formatGradeLabel(grade);

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
        schedule: {
          monday: schedule?.monday || false,
          tuesday: schedule?.tuesday || false,
          wednesday: schedule?.wednesday || false,
          thursday: schedule?.thursday || false,
          friday: schedule?.friday || false,
          saturday: schedule?.saturday || false,
          sunday: schedule?.sunday || false,
        },
        updated_at: schedule?.updated_at || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        children: formattedChildren,
        total: formattedChildren.length,
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
