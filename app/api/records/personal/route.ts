import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { isValidUUID } from '@/lib/utils/validation';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { calculateGrade, formatGradeLabel } from '@/utils/grade';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';

// Date parameter validation helper
const isValidDateParam = (v: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
};

// Content validation constants
const MAX_CONTENT_LENGTH = 5000;

/**
 * 個別観察記録一覧を取得するAPIエンドポイント
 * GET /api/records/personal
 */
export async function GET(request: NextRequest) {
  try {
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const facility_id = metadata.current_facility_id;

    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const from_date = searchParams.get('from_date') ?? undefined;
    const to_date = searchParams.get('to_date') ?? undefined;
    const class_id = searchParams.get('class_id') ?? undefined;
    const staff_id_raw = searchParams.get('staff_id') ?? undefined;
    if (staff_id_raw && !isValidUUID(staff_id_raw)) {
      return NextResponse.json({ success: false, error: 'Invalid staff_id format' }, { status: 400 });
    }
    const staff_id = staff_id_raw;
    const child_id_raw = searchParams.get('child_id') ?? undefined;
    if (child_id_raw && !isValidUUID(child_id_raw)) {
      return NextResponse.json({ success: false, error: 'Invalid child_id format' }, { status: 400 });
    }
    const child_id_param = child_id_raw;
    const child_name = searchParams.get('child_name') ?? undefined;
    const grade = searchParams.get('grade') ?? undefined;
    const keywordRaw = searchParams.get('keyword');
    const keyword = keywordRaw && keywordRaw.length <= 100 ? keywordRaw : keywordRaw ? keywordRaw.slice(0, 100) : undefined;

    if (from_date && !isValidDateParam(from_date)) {
      return NextResponse.json({ success: false, error: 'Invalid from_date format' }, { status: 400 });
    }
    if (to_date && !isValidDateParam(to_date)) {
      return NextResponse.json({ success: false, error: 'Invalid to_date format' }, { status: 400 });
    }
    if (from_date && to_date && from_date > to_date) {
      return NextResponse.json({ success: false, error: 'from_date must be before or equal to to_date' }, { status: 400 });
    }

    const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10);
    const limit = Number.isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);
    const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10);
    const offset = Number.isNaN(rawOffset) ? 0 : Math.max(rawOffset, 0);

    // class_id フィルター: 2ステップで child_id リストを取得
    let classFilterChildIds: string[] | null = null;
    if (class_id) {
      const { data: classChildren } = await supabase
        .from('_child_class')
        .select('child_id')
        .eq('class_id', class_id)
        .eq('is_current', true);
      classFilterChildIds = classChildren?.map((c) => c.child_id) ?? [];
      if (classFilterChildIds.length === 0) {
        return NextResponse.json({ success: true, data: { observations: [], total: 0, has_more: false } });
      }
    }

    // child_name フィルター: 他フィルターで絞り込んでから復号後に部分一致検索
    let nameFilterChildIds: string[] | null = null;
    if (child_name) {
      let nameSearchQuery = supabase
        .from('m_children')
        .select('id, family_name, given_name, family_name_kana, given_name_kana, nickname')
        .eq('facility_id', facility_id)
        .is('deleted_at', null);

      // class_id フィルターが既に適用済みの場合、その child_id リストに絞り込む
      if (classFilterChildIds !== null) {
        nameSearchQuery = nameSearchQuery.in('id', classFilterChildIds);
      }
      // child_id 直接指定がある場合も絞り込む
      if (child_id_param) {
        nameSearchQuery = nameSearchQuery.eq('id', child_id_param);
      }

      const { data: allChildrenForName } = await nameSearchQuery;

      const searchLower = child_name.toLowerCase();
      nameFilterChildIds = (allChildrenForName ?? [])
        .filter((c) => {
          const familyName = decryptOrFallback(c.family_name) ?? '';
          const givenName = decryptOrFallback(c.given_name) ?? '';
          const familyNameKana = decryptOrFallback(c.family_name_kana) ?? '';
          const givenNameKana = decryptOrFallback(c.given_name_kana) ?? '';
          const nickname = c.nickname ?? '';

          const fullName = `${familyName}${givenName}`.toLowerCase();
          const fullNameKana = `${familyNameKana}${givenNameKana}`.toLowerCase();
          const fullNameWithSpace = `${familyName} ${givenName}`.toLowerCase();
          const fullNameKanaWithSpace = `${familyNameKana} ${givenNameKana}`.toLowerCase();

          return (
            fullName.includes(searchLower) ||
            fullNameWithSpace.includes(searchLower) ||
            familyName.toLowerCase().includes(searchLower) ||
            givenName.toLowerCase().includes(searchLower) ||
            fullNameKana.includes(searchLower) ||
            fullNameKanaWithSpace.includes(searchLower) ||
            familyNameKana.toLowerCase().includes(searchLower) ||
            givenNameKana.toLowerCase().includes(searchLower) ||
            nickname.toLowerCase().includes(searchLower)
          );
        })
        .map((c) => c.id);

      if (nameFilterChildIds.length === 0) {
        return NextResponse.json({ success: true, data: { observations: [], total: 0, has_more: false } });
      }
    }

    // grade フィルター: 施設の全児童から学年一致する child_id リストを取得
    let gradeFilterChildIds: string[] | null = null;
    if (grade) {
      const gradeNum = parseInt(grade, 10);
      if (!Number.isNaN(gradeNum)) {
        const { data: allChildren } = await supabase
          .from('m_children')
          .select('id, birth_date, grade_add')
          .eq('facility_id', facility_id)
          .is('deleted_at', null);
        gradeFilterChildIds = (allChildren ?? [])
          .filter((c) => calculateGrade(c.birth_date, c.grade_add) === gradeNum)
          .map((c) => c.id);
        if (gradeFilterChildIds.length === 0) {
          return NextResponse.json({ success: true, data: { observations: [], total: 0, has_more: false } });
        }
      }
    }

    // child_id 直接指定フィルター
    const directChildIdFilter: string[] | null = child_id_param ? [child_id_param] : null;

    // child_id の絞り込みリストを結合（複数フィルターが AND 条件になる）
    let childIdFilter: string[] | null = null;
    for (const idList of [directChildIdFilter, classFilterChildIds, nameFilterChildIds, gradeFilterChildIds]) {
      if (idList === null) continue;
      if (childIdFilter === null) {
        childIdFilter = idList;
      } else {
        const idSet = new Set(idList);
        childIdFilter = childIdFilter.filter((id) => idSet.has(id));
        if (childIdFilter.length === 0) {
          return NextResponse.json({ success: true, data: { observations: [], total: 0, has_more: false } });
        }
      }
    }

    // メインクエリ
    let query = supabase
      .from('r_observation')
      .select(
        `
        id,
        child_id,
        observation_date,
        content,
        objective,
        subjective,
        is_ai_analyzed,
        created_by,
        recorded_by,
        m_children!inner(
          id,
          family_name,
          given_name,
          nickname,
          birth_date,
          grade_add,
          facility_id,
          _child_class(
            is_current,
            class_id,
            m_classes(id, name)
          )
        ),
        m_users!r_observation_created_by_fkey(id, name),
        recorded_by_user:m_users!recorded_by(id, name),
        _record_tag(
          m_observation_tags(id, name, color)
        )
      `,
        { count: 'exact' }
      )
      .eq('m_children.facility_id', facility_id)
      .is('deleted_at', null)
      .order('observation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (childIdFilter !== null) {
      query = query.in('child_id', childIdFilter);
    }
    if (from_date) {
      query = query.gte('observation_date', from_date);
    }
    if (to_date) {
      query = query.lte('observation_date', to_date);
    }
    if (staff_id) {
      query = query.eq('recorded_by', staff_id);
    }
    if (keyword) {
      const escapedKeyword = keyword.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.ilike('content', `%${escapedKeyword}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Personal observations fetch error:', error);
      return NextResponse.json({ success: false, error: 'データの取得に失敗しました' }, { status: 500 });
    }

    const total = count ?? 0;
    const has_more = offset + limit < total;

    // データ整形
    const observations = (data ?? []).map((obs) => {
      const child = Array.isArray(obs.m_children) ? obs.m_children[0] : obs.m_children;
      const childClasses = Array.isArray(child?._child_class) ? child._child_class : [];
      const currentClassEntry = childClasses.find((cc: { is_current: boolean }) => cc.is_current);
      const mClass = currentClassEntry
        ? (Array.isArray(currentClassEntry.m_classes) ? currentClassEntry.m_classes[0] : currentClassEntry.m_classes)
        : null;

      const recordTags = Array.isArray(obs._record_tag) ? obs._record_tag : [];
      const firstTag = recordTags[0] ?? null;
      const tagData = firstTag
        ? (Array.isArray(firstTag.m_observation_tags) ? firstTag.m_observation_tags[0] : firstTag.m_observation_tags)
        : null;

      const staffUser = Array.isArray(obs.m_users) ? obs.m_users[0] : obs.m_users;
      const recordedByUser = Array.isArray(obs.recorded_by_user) ? obs.recorded_by_user[0] : obs.recorded_by_user;

      const childDisplayName = child
        ? (formatName([
            decryptOrFallback(child.family_name),
            decryptOrFallback(child.given_name),
          ], '') ?? '')
        : '';

      const gradeNum = child ? calculateGrade(child.birth_date, child.grade_add) : null;

      return {
        id: obs.id,
        observation_date: obs.observation_date,
        child_id: obs.child_id,
        child_name: childDisplayName,
        class_id: mClass?.id ?? null,
        class_name: mClass?.name ?? null,
        grade: gradeNum,
        grade_label: formatGradeLabel(gradeNum),
        category: tagData?.name ?? null,
        category_color: tagData?.color ?? null,
        content: obs.content,
        objective: obs.objective ?? null,
        subjective: obs.subjective ?? null,
        is_ai_analyzed: obs.is_ai_analyzed ?? false,
        staff_name: staffUser?.name ?? null,
        recorded_by_name: recordedByUser?.name ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        observations,
        total,
        has_more,
      },
    });
  } catch (error) {
    console.error('Personal observations GET API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * 新規観察記録を作成するAPIエンドポイント
 * POST /api/records/personal
 */
export async function POST(request: NextRequest) {
  try {
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata || !metadata.current_facility_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const body = await request.json();
    const { child_id, observation_date, content, ai_action, ai_opinion, tag_flags, activity_id, recorded_by } = body;
    const objective = typeof ai_action === 'string' ? ai_action.trim() : '';
    const subjective = typeof ai_opinion === 'string' ? ai_opinion.trim() : '';
    const hasAiResult = Boolean(objective || subjective);

    // activity_idの正規化（空文字列はnullに変換）
    const normalizedActivityId = activity_id && typeof activity_id === 'string' && activity_id.trim() !== ''
      ? activity_id
      : null;

    // activity_id が指定されている場合は、その activity が現在の facility に所属しているか確認
    if (normalizedActivityId) {
      const { data: activityData, error: activityError } = await supabase
        .from('r_activity')
        .select('facility_id')
        .eq('id', normalizedActivityId)
        .is('deleted_at', null)
        .single();

      if (activityError || !activityData || activityData.facility_id !== metadata.current_facility_id) {
        return NextResponse.json(
          { success: false, error: 'Invalid activity_id or activity does not belong to this facility' },
          { status: 400 }
        );
      }
    }

    // バリデーション
    if (!child_id || !observation_date || !content) {
      return NextResponse.json(
        { success: false, error: '必須項目が不足しています (child_id, observation_date, content)' },
        { status: 400 },
      );
    }

    // recorded_by は必須
    if (!recorded_by || (typeof recorded_by === 'string' && !recorded_by.trim())) {
      return NextResponse.json(
        { success: false, error: 'recorded_by は必須です' },
        { status: 400 },
      );
    }

    // Content length validation
    if (typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // recorded_by のUUID形式検証 + 同一会社の有効スタッフか確認
    if (recorded_by) {
      if (!isValidUUID(recorded_by)) {
        return NextResponse.json(
          { success: false, error: 'Invalid recorded_by ID format' },
          { status: 400 }
        );
      }
      const { data: recorder } = await supabase
        .from('m_users')
        .select('id')
        .eq('id', recorded_by)
        .eq('company_id', metadata.company_id)
        .eq('is_active', true)
        .is('deleted_at', null)
        .single();
      if (!recorder) {
        return NextResponse.json(
          { success: false, error: 'recorded_by user not found or not in your company' },
          { status: 400 }
        );
      }
    }

    // 子どもが現在の施設に所属しているか確認
    const { data: childData, error: childError } = await supabase
      .from('m_children')
      .select('facility_id')
      .eq('id', child_id)
      .is('deleted_at', null)
      .single();

    if (childError || !childData) {
      return NextResponse.json({ success: false, error: '子どもが見つかりません' }, { status: 404 });
    }

    if (childData.facility_id !== metadata.current_facility_id) {
      return NextResponse.json({ success: false, error: 'この子どもの記録を作成する権限がありません' }, { status: 403 });
    }

    // 観察記録を作成
    const { data: observationData, error: insertError } = await supabase
      .from('r_observation')
      .insert({
        child_id,
        observation_date,
        content,
        activity_id: normalizedActivityId,
        objective: objective || null,
        subjective: subjective || null,
        is_ai_analyzed: hasAiResult,
        ai_analyzed_at: hasAiResult ? new Date().toISOString() : null,
        created_by: metadata.user_id,
        updated_by: metadata.user_id,
        recorded_by: recorded_by || null,
      })
      .select('id')
      .single();

    if (insertError || !observationData) {
      console.error('Observation insert error:', insertError);
      return NextResponse.json({ success: false, error: '観察記録の作成に失敗しました' }, { status: 500 });
    }

    const observationId = observationData.id;

    // AI解析結果（タグ）を保存
    if (tag_flags && typeof tag_flags === 'object') {
      const tagInserts = Object.entries(tag_flags)
        .filter(([_, value]) => value === true || value === 1)
        .map(([tagId]) => ({
          observation_id: observationId,
          tag_id: tagId,
          is_auto_tagged: true,
          confidence_score: null,
        }));

      if (tagInserts.length > 0) {
        const { error: tagError } = await supabase.from('_record_tag').insert(tagInserts);

        if (tagError) {
          console.error('Tag insert error:', tagError);
          // タグ挿入エラーは致命的でないため、警告のみ
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: observationId,
        child_id,
        observation_date,
        content,
      },
    });
  } catch (error) {
    console.error('Observation create API error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
