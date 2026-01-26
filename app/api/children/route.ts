import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { handleChildSave } from './save/route';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { isoToDateJST } from '@/lib/utils/timezone';
import { searchByName } from '@/utils/pii/searchIndex';

// GET /api/children - 子ども一覧取得
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

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'enrolled'; // enrolled / withdrawn
    const class_id = searchParams.get('class_id') || null;
    const search = searchParams.get('search') || null;
    const has_allergy = searchParams.get('has_allergy');
    const has_sibling = searchParams.get('has_sibling');
    const enrollment_type = searchParams.get('enrollment_type') || null;
    const sort_by = searchParams.get('sort_by') || 'name';
    const sort_order = searchParams.get('sort_order') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 1. 子ども一覧取得
    let childrenQuery = supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        gender,
        birth_date,
        grade_add,
        photo_url,
        enrollment_status,
        enrollment_type,
        enrolled_at,
        withdrawn_at,
        parent_phone,
        parent_email,
        allergies,
        photo_permission_public,
        report_name_permission,
        _child_class (
          class_id,
          is_current,
          m_classes (
            id,
            name,
            age_group
          )
        ),
        _child_guardian (
          relationship,
          is_primary,
          is_emergency_contact,
          m_guardians (
            id,
            family_name,
            given_name,
            phone,
            email
          )
        )
      `)
      .eq('facility_id', facility_id)
      .eq('enrollment_status', status)
      .is('deleted_at', null);

    if (class_id) {
      childrenQuery = childrenQuery.eq('_child_class.class_id', class_id);
    }

    // 名前検索: 漢字名は検索用ハッシュテーブル経由、カナは直接DB検索（平文のため）
    let searchChildIds: string[] | null = null;
    if (search) {
      // 漢字名は暗号化されているためインデックス経由で検索
      const nameIds = await searchByName(supabase, 'child', 'name', search);

      // カナは平文なので直接DB検索
      // 特殊文字をエスケープしてSQL injection/filter breakを防止
      const escapedSearch = search
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      const { data: kanaMatches, error: kanaError } = await supabase
        .from('m_children')
        .select('id')
        .eq('facility_id', facility_id)
        .is('deleted_at', null)
        .or(`family_name_kana.ilike.%${escapedSearch}%,given_name_kana.ilike.%${escapedSearch}%`);

      if (kanaError) {
        console.error('Kana search error:', kanaError);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      const kanaIds = kanaMatches?.map(c => c.id) || [];
      searchChildIds = [...new Set([...nameIds, ...kanaIds])];

      if (searchChildIds.length === 0) {
        // 検索結果がない場合は空の結果を返す
        return NextResponse.json({
          success: true,
          data: {
            children: [],
            total: 0,
            summary: {
              total: 0,
              enrolled: 0,
              withdrawn: 0,
              has_allergy: 0,
            },
          },
        });
      }

      childrenQuery = childrenQuery.in('id', searchChildIds);
    }

    if (has_allergy !== null) {
      if (has_allergy === 'true') {
        childrenQuery = childrenQuery.not('allergies', 'is', null);
      } else {
        childrenQuery = childrenQuery.is('allergies', null);
      }
    }

    if (enrollment_type) {
      childrenQuery = childrenQuery.eq('enrollment_type', enrollment_type);
    }

    // ソート
    const sortColumn = sort_by === 'name' ? 'family_name_kana' : sort_by;
    childrenQuery = childrenQuery.order(sortColumn, { ascending: sort_order === 'asc' });

    // ページネーション
    childrenQuery = childrenQuery.range(offset, offset + limit - 1);

    const { data: childrenData, error: childrenError, count } = await childrenQuery;

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    if (!childrenData || childrenData.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          summary: {
            total_children: 0,
            enrolled_count: 0,
            withdrawn_count: 0,
            has_allergy_count: 0,
            has_sibling_count: 0,
          },
          children: [],
          filters: {
            classes: [],
            enrollment_types: [],
          },
          total: 0,
          has_more: false,
        },
      });
    }

    const childIds = childrenData.map((c: any) => c.id);

    // 2. 兄弟情報取得
    const { data: siblingsData } = await supabase
      .from('_child_sibling')
      .select(`
        child_id,
        sibling_id,
        relationship,
        m_children!_child_sibling_sibling_id_fkey (
          id,
          family_name,
          given_name,
          _child_class!inner (
            m_classes (
              name,
              age_group
            )
          )
        )
      `)
      .in('child_id', childIds);

    // PIIフィールドを復号化（失敗時は平文として扱う - 後方互換性）
  

  

    // データ整形
    const children = childrenData.map((child: any) => {
      // クラス情報（現在所属中のクラスのみ）
      const currentClass = child._child_class?.find((cc: any) => cc.is_current);
      const classInfo = currentClass?.m_classes;

      // 保護者情報の整形（復号化）
      const guardians = child._child_guardian || [];
      const primaryGuardian = guardians.find((g: any) => g.is_primary);
      const decryptedPrimaryGuardian = primaryGuardian ? {
        ...primaryGuardian,
        m_guardians: {
          ...primaryGuardian.m_guardians,
          family_name: decryptOrFallback(primaryGuardian.m_guardians.family_name),
          given_name: decryptOrFallback(primaryGuardian.m_guardians.given_name),
          phone: decryptOrFallback(primaryGuardian.m_guardians.phone),
          email: decryptOrFallback(primaryGuardian.m_guardians.email),
        },
      } : null;

      // 年齢計算
      const birthDate = new Date(child.birth_date);
      const today = new Date();
      const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      const grade = calculateGrade(child.birth_date, child.grade_add);
      const gradeLabel = formatGradeLabel(grade);

      // 兄弟情報（復号化）
      const childSiblings = (siblingsData || [])
        .filter((s: any) => s.child_id === child.id)
        .map((s: any) => {
          const siblingInfo = s.m_children;
          const siblingCurrentClass = siblingInfo?._child_class?.find((cc: any) => cc.is_current);
          const siblingClass = siblingCurrentClass?.m_classes;
          const decryptedFamilyName = decryptOrFallback(siblingInfo?.family_name);
          const decryptedGivenName = decryptOrFallback(siblingInfo?.given_name);
          return {
            child_id: siblingInfo?.id,
            name: formatName([decryptedFamilyName, decryptedGivenName], ''),
            age_group: siblingClass?.age_group || '',
            relationship: s.relationship,
          };
        });

      // 児童情報を復号化
      const decryptedFamilyName = decryptOrFallback(child.family_name);
      const decryptedGivenName = decryptOrFallback(child.given_name);
      const decryptedFamilyNameKana = decryptOrFallback(child.family_name_kana);
      const decryptedGivenNameKana = decryptOrFallback(child.given_name_kana);
      const decryptedAllergies = decryptOrFallback(child.allergies);

      return {
        child_id: child.id,
        name: formatName([decryptedFamilyName, decryptedGivenName], ''),
        kana: formatName([decryptedFamilyNameKana, decryptedGivenNameKana], ''),
        gender: child.gender,
        birth_date: child.birth_date,
        age,
        grade,
        grade_label: gradeLabel,
        age_group: classInfo?.age_group || '',
        class_id: classInfo?.id || null,
        class_name: classInfo?.name || '',
        photo_url: child.photo_url,
        enrollment_status: child.enrollment_status,
        enrollment_type: child.enrollment_type,
        enrollment_date: child.enrolled_at ? isoToDateJST(child.enrolled_at) : null,
        withdrawal_date: child.withdrawn_at ? isoToDateJST(child.withdrawn_at) : null,
        parent_name: decryptedPrimaryGuardian
          ? formatName(
              [
                decryptedPrimaryGuardian.m_guardians.family_name,
                decryptedPrimaryGuardian.m_guardians.given_name,
              ],
              null
            )
          : null,
        parent_phone: decryptedPrimaryGuardian?.m_guardians.phone || decryptOrFallback(child.parent_phone) || null,
        parent_email: decryptedPrimaryGuardian?.m_guardians.email || decryptOrFallback(child.parent_email) || null,
        siblings: childSiblings,
        has_sibling: childSiblings.length > 0,
        has_allergy: !!decryptedAllergies,
        allergy_detail: decryptedAllergies,
        photo_allowed: child.photo_permission_public,
        report_allowed: child.report_name_permission,
        created_at: child.created_at,
        updated_at: child.updated_at,
      };
    });

    // has_siblingフィルター適用（兄弟データ取得後）
    const filteredChildren = has_sibling !== null
      ? children.filter(c => c.has_sibling === (has_sibling === 'true'))
      : children;

    // サマリー取得
    const { data: summaryData } = await supabase
      .from('m_children')
      .select('enrollment_status, allergies', { count: 'exact' })
      .eq('facility_id', facility_id)
      .is('deleted_at', null);

    const enrolledCount = (summaryData || []).filter((c: any) => c.enrollment_status === 'enrolled').length;
    const withdrawnCount = (summaryData || []).filter((c: any) => c.enrollment_status === 'withdrawn').length;
    const hasAllergyCount = (summaryData || []).filter((c: any) => c.allergies !== null).length;
    const hasSiblingCount = children.filter(c => c.has_sibling).length;

    // クラス一覧（フィルター用）
    const { data: classesData } = await supabase
      .from('m_classes')
      .select('id, name')
      .eq('facility_id', facility_id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');

    // 児童数取得
    const { data: classChildrenCount } = await supabase
      .from('_child_class')
      .select('class_id, child_id')
      .eq('is_current', true)
      .in('class_id', (classesData || []).map((c: any) => c.id));

    const classCountMap: Record<string, number> = {};
    (classChildrenCount || []).forEach((cc: any) => {
      classCountMap[cc.class_id] = (classCountMap[cc.class_id] || 0) + 1;
    });

    const filters = {
      classes: (classesData || []).map((cls: any) => ({
        class_id: cls.id,
        class_name: cls.name,
        children_count: classCountMap[cls.id] || 0,
      })),
      enrollment_types: [
        { type: 'regular', label: '通年', count: children.filter(c => c.enrollment_type === 'regular').length },
        { type: 'temporary', label: '一時', count: children.filter(c => c.enrollment_type === 'temporary').length },
        { type: 'spot', label: 'スポット', count: children.filter(c => c.enrollment_type === 'spot').length },
      ],
    };

    // レスポンス構築
    const response = {
      success: true,
      data: {
        summary: {
          total_children: enrolledCount + withdrawnCount,
          enrolled_count: enrolledCount,
          withdrawn_count: withdrawnCount,
          has_allergy_count: hasAllergyCount,
          has_sibling_count: hasSiblingCount,
        },
        children: filteredChildren,
        filters,
        total: count || filteredChildren.length,
        has_more: (count || 0) > offset + limit,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Children API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/children - 新規登録
export async function POST(request: NextRequest) {
  return handleChildSave(request);
}
