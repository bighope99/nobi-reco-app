import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { handleChildSave } from './save/route';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { isoToDateJST } from '@/lib/utils/timezone';
import { searchByName } from '@/utils/pii/searchIndex';
import { normalizeSearch } from '@/lib/utils/kana';

// GET /api/children - 子ども一覧取得
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { role, current_facility_id, company_id } = metadata;

    // クエリパラメータ取得
    const { searchParams } = new URL(request.url);

    // company_admin / site_admin はクエリパラメータで施設IDを指定可能
    const facilityIdQuery = searchParams.get('facility_id') || '';
    let facility_id: string;
    // company_adminは全施設モード（facility_id未指定）を許可
    let allFacilityIds: string[] | null = null; // null=単一施設モード、配列=全施設モード
    let facilityNameMap: Map<string, string> = new Map();

    if (role === 'company_admin' || role === 'site_admin') {
      facility_id = facilityIdQuery || current_facility_id || '';
    } else {
      facility_id = current_facility_id || '';
    }

    // company_adminで施設IDが未指定の場合、自社全施設を横断表示
    if (role === 'company_admin' && !facilityIdQuery) {
      const { data: companyFacilities } = await supabase
        .from('m_facilities')
        .select('id, name')
        .eq('company_id', company_id)
        .is('deleted_at', null);
      if (!companyFacilities || companyFacilities.length === 0) {
        return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
      }
      allFacilityIds = companyFacilities.map((f: { id: string; name: string }) => f.id);
      companyFacilities.forEach((f: { id: string; name: string }) => facilityNameMap.set(f.id, f.name));
      // facility_idは使用しないが型の都合でセット
      facility_id = allFacilityIds[0];
    } else {
      if (!facility_id) {
        return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
      }

      // company_adminのスコープチェック: 自社施設のみ閲覧可能
      if (role === 'company_admin') {
        const { data: scopedFacility } = await supabase
          .from('m_facilities')
          .select('id, name')
          .eq('id', facility_id)
          .eq('company_id', company_id)
          .is('deleted_at', null)
          .maybeSingle();
        if (!scopedFacility) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        facilityNameMap.set(scopedFacility.id, scopedFacility.name);
      }
    }

    const status = searchParams.get('status') || 'enrolled'; // enrolled / withdrawn
    const class_id = searchParams.get('class_id') || null;
    const search = searchParams.get('search') || null;
    const has_allergy = searchParams.get('has_allergy');
    const has_sibling = searchParams.get('has_sibling');
    const enrollment_type = searchParams.get('enrollment_type') || null;
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 施設全体のサマリーとフィルター情報を取得するヘルパー
    const fetchSummaryAndFilters = async () => {
      // サマリーとクラス一覧を並列取得（全施設モードではin()を使用）
      let summaryQuery = supabase
        .from('m_children')
        .select('enrollment_status, allergies')
        .is('deleted_at', null);
      let classesQuery = supabase
        .from('m_classes')
        .select('id, name')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name');
      if (allFacilityIds) {
        summaryQuery = summaryQuery.in('facility_id', allFacilityIds);
        classesQuery = classesQuery.in('facility_id', allFacilityIds);
      } else {
        summaryQuery = summaryQuery.eq('facility_id', facility_id);
        classesQuery = classesQuery.eq('facility_id', facility_id);
      }
      const [{ data: summaryData }, { data: classesData }] = await Promise.all([
        summaryQuery,
        classesQuery,
      ]);

      const enrolledCount = (summaryData || []).filter((c: any) => c.enrollment_status === 'enrolled').length;
      const withdrawnCount = (summaryData || []).filter((c: any) => c.enrollment_status === 'withdrawn').length;
      const hasAllergyCount = (summaryData || []).filter((c: any) => c.allergies !== null).length;

      // クラスに紐づく児童数を取得
      const classIds = (classesData || []).map((c: any) => c.id);
      let classCountMap: Record<string, number> = {};
      if (classIds.length > 0) {
        const { data: classChildrenCount } = await supabase
          .from('_child_class')
          .select('class_id, child_id')
          .eq('is_current', true)
          .in('class_id', classIds);

        (classChildrenCount || []).forEach((cc: any) => {
          classCountMap[cc.class_id] = (classCountMap[cc.class_id] || 0) + 1;
        });
      }

      return {
        summary: {
          total_children: enrolledCount + withdrawnCount,
          enrolled_count: enrolledCount,
          withdrawn_count: withdrawnCount,
          has_allergy_count: hasAllergyCount,
          has_sibling_count: 0, // 兄弟数は結果に依存するため呼び出し側で上書き
        },
        filters: {
          classes: (classesData || []).map((cls: any) => ({
            class_id: cls.id,
            class_name: cls.name,
            children_count: classCountMap[cls.id] || 0,
          })),
          enrollment_types: [] as Array<{ type: string; label: string; count: number }>,
        },
      };
    };

    // 1. 子ども一覧取得
    // class_idフィルター時は !inner JOINで該当クラスの子のみに絞る
    const childClassJoin = class_id && class_id !== 'none'
      ? `_child_class!inner (
          class_id,
          is_current,
          m_classes (
            id,
            name,
            age_group
          )
        )`
      : `_child_class (
          class_id,
          is_current,
          m_classes (
            id,
            name,
            age_group
          )
        )`;

    let childrenQuery = supabase
      .from('m_children')
      .select(`
        id,
        facility_id,
        school_id,
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
        m_schools (
          id,
          name
        ),
        ${childClassJoin},
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
      .eq('enrollment_status', status)
      .is('deleted_at', null);

    // 全施設モードか単一施設モードかでfilterを切り替え
    if (allFacilityIds) {
      childrenQuery = childrenQuery.in('facility_id', allFacilityIds);
    } else {
      childrenQuery = childrenQuery.eq('facility_id', facility_id);
    }

    if (class_id && class_id !== 'none') {
      childrenQuery = childrenQuery
        .eq('_child_class.class_id', class_id)
        .eq('_child_class.is_current', true);
    }

    // 名前検索: 漢字名は検索用ハッシュテーブル経由、カナは直接DB検索（平文のため）
    let searchChildIds: string[] | null = null;
    if (search) {
      // 漢字名は暗号化されているためインデックス経由で検索
      const nameIds = await searchByName(supabase, 'child', 'name', search);

      // カナは平文なので直接DB検索
      // ひらがな→カタカナに正規化してから検索（表記ゆれ対応）
      // 特殊文字をエスケープしてSQL injection/filter breakを防止
      const normalizedSearch = normalizeSearch(search);
      const escapedSearch = normalizedSearch
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      let kanaSearchQuery = supabase
        .from('m_children')
        .select('id')
        .is('deleted_at', null)
        .or(`family_name_kana.ilike.%${escapedSearch}%,given_name_kana.ilike.%${escapedSearch}%`);
      if (allFacilityIds) {
        kanaSearchQuery = kanaSearchQuery.in('facility_id', allFacilityIds);
      } else {
        kanaSearchQuery = kanaSearchQuery.eq('facility_id', facility_id);
      }
      const { data: kanaMatches, error: kanaError } = await kanaSearchQuery;

      if (kanaError) {
        console.error('Kana search error:', kanaError);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      const kanaIds = kanaMatches?.map(c => c.id) || [];
      searchChildIds = [...new Set([...nameIds, ...kanaIds])];

      if (searchChildIds.length === 0) {
        // 検索結果がない場合でも施設全体のサマリーとクラス一覧は返す
        const { summary, filters } = await fetchSummaryAndFilters();
        return NextResponse.json({
          success: true,
          data: {
            children: [],
            total: 0,
            summary,
            filters,
            has_more: false,
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

    // ソートはクライアント側で処理するため、デフォルトのカナ順で返す
    childrenQuery = childrenQuery.order('family_name_kana', { ascending: true });

    // ページネーション
    childrenQuery = childrenQuery.range(offset, offset + limit - 1);

    const { data: childrenData, error: childrenError, count } = await childrenQuery;

    if (childrenError) {
      console.error('Children fetch error:', childrenError);
      return NextResponse.json({ error: 'Failed to fetch children' }, { status: 500 });
    }

    if (!childrenData || childrenData.length === 0) {
      // 結果0件でも施設全体のサマリーとクラス一覧は返す
      const { summary, filters } = await fetchSummaryAndFilters();
      return NextResponse.json({
        success: true,
        data: {
          summary,
          children: [],
          filters,
          total: 0,
          has_more: false,
        },
      });
    }

    const childIds = childrenData.map((c: any) => c.id);

    // 2. 兄弟情報とサマリー・フィルターを並列取得
    const [{ data: siblingsData }, { summary, filters }] = await Promise.all([
      supabase
        .from('_child_sibling')
        .select(`
          child_id,
          sibling_id,
          relationship,
          m_children!_child_sibling_sibling_id_fkey (
            id,
            family_name,
            given_name,
            _child_class (
              m_classes (
                name,
                age_group
              )
            )
          )
        `)
        .in('child_id', childIds),
      fetchSummaryAndFilters(),
    ]);

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
        school_id: child.school_id || null,
        school_name: (child.m_schools as { id: string; name: string } | null)?.name || null,
        facility_name: facilityNameMap.get(child.facility_id) || '',
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
    let filteredChildren = has_sibling !== null
      ? children.filter(c => c.has_sibling === (has_sibling === 'true'))
      : children;

    // 「クラスなし」フィルター: is_current=trueのクラス所属がない子のみ
    if (class_id === 'none') {
      filteredChildren = filteredChildren.filter(c => c.class_id === null);
    }

    const hasSiblingCount = children.filter(c => c.has_sibling).length;
    summary.has_sibling_count = hasSiblingCount;

    filters.enrollment_types = [
      { type: 'regular', label: '通年', count: children.filter(c => c.enrollment_type === 'regular').length },
      { type: 'temporary', label: '一時', count: children.filter(c => c.enrollment_type === 'temporary').length },
      { type: 'spot', label: 'スポット', count: children.filter(c => c.enrollment_type === 'spot').length },
    ];

    // レスポンス構築
    const response = {
      success: true,
      data: {
        summary,
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
