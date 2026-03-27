import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { getCurrentDateJST } from '@/lib/utils/timezone';

interface TransferRequest {
  mode: 'preview' | 'commit';
  childIds: string[];
  targetClassId?: string;
  targetSchoolId?: string;
  targetFacilityId?: string;
  schoolYear?: number;
}

interface ChildPreview {
  child_id: string;
  name: string;
  current_class_name: string | null;
  current_school_name: string | null;
  current_facility_name: string;
  target_class_name: string | null;
  target_school_name: string | null;
  target_facility_name: string | null;
  changes: {
    class: boolean;
    school: boolean;
    facility: boolean;
  };
}

interface CommitError {
  child_id: string;
  error: string;
}

// POST /api/children/transfer - 子どもの一括クラス・学校・施設異動
export async function POST(request: NextRequest) {
  try {
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, current_facility_id, company_id } = metadata;

    if (role !== 'company_admin' && role !== 'site_admin' && role !== 'facility_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    let body: TransferRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      mode,
      childIds,
      targetClassId,
      targetSchoolId,
      targetFacilityId,
      schoolYear,
    } = body;
    const resolvedSchoolYear: number = schoolYear ?? new Date().getFullYear();

    // バリデーション
    if (!childIds || childIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'childIds must have at least one entry' },
        { status: 400 }
      );
    }

    if (!targetClassId && !targetSchoolId && !targetFacilityId) {
      return NextResponse.json(
        { success: false, error: 'At least one of targetClassId, targetSchoolId, or targetFacilityId is required' },
        { status: 400 }
      );
    }

    if (role === 'facility_admin' && targetFacilityId) {
      return NextResponse.json(
        { success: false, error: 'facility_admin cannot change facility' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // facility_admin は自分の施設内の子どものみ操作可能
    const facilityId = current_facility_id || '';

    // company_admin / site_admin が targetFacilityId を指定した場合、同一会社内かチェック
    if (targetFacilityId && (role === 'company_admin' || role === 'site_admin')) {
      const { data: targetFacility, error: facilityError } = await supabase
        .from('m_facilities')
        .select('id, company_id')
        .eq('id', targetFacilityId)
        .is('deleted_at', null)
        .maybeSingle();

      if (facilityError) {
        console.error('Failed to fetch target facility:', facilityError);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
      }

      if (!targetFacility) {
        return NextResponse.json({ success: false, error: 'Target facility not found' }, { status: 404 });
      }

      if (role === 'company_admin' && targetFacility.company_id !== company_id) {
        return NextResponse.json(
          { success: false, error: 'Target facility does not belong to your company' },
          { status: 403 }
        );
      }
    }

    // targetClassId の所有チェック（指定クラスが自施設/自社内かを確認）
    if (targetClassId) {
      const { data: targetClass, error: classCheckError } = await supabase
        .from('m_classes')
        .select('id, facility_id')
        .eq('id', targetClassId)
        .is('deleted_at', null)
        .maybeSingle();

      if (classCheckError) {
        console.error('Failed to fetch target class:', classCheckError);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
      }
      if (!targetClass) {
        return NextResponse.json({ success: false, error: 'Target class not found' }, { status: 404 });
      }
      if (role === 'facility_admin' && targetClass.facility_id !== facilityId) {
        return NextResponse.json(
          { success: false, error: 'Target class does not belong to your facility' },
          { status: 403 }
        );
      }
      if (role === 'company_admin') {
        const { data: classF } = await supabase
          .from('m_facilities')
          .select('company_id')
          .eq('id', targetClass.facility_id)
          .maybeSingle();
        if (classF?.company_id !== company_id) {
          return NextResponse.json(
            { success: false, error: 'Target class does not belong to your company' },
            { status: 403 }
          );
        }
      }
    }

    // targetSchoolId の所有チェック（指定学校が自施設/自社内かを確認）
    if (targetSchoolId) {
      const { data: targetSchool, error: schoolCheckError } = await supabase
        .from('m_schools')
        .select('id, facility_id')
        .eq('id', targetSchoolId)
        .is('deleted_at', null)
        .maybeSingle();

      if (schoolCheckError) {
        console.error('Failed to fetch target school:', schoolCheckError);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
      }
      if (!targetSchool) {
        return NextResponse.json({ success: false, error: 'Target school not found' }, { status: 404 });
      }
      if (role === 'facility_admin' && targetSchool.facility_id !== facilityId) {
        return NextResponse.json(
          { success: false, error: 'Target school does not belong to your facility' },
          { status: 403 }
        );
      }
      if (role === 'company_admin') {
        const { data: schoolF } = await supabase
          .from('m_facilities')
          .select('company_id')
          .eq('id', targetSchool.facility_id)
          .maybeSingle();
        if (schoolF?.company_id !== company_id) {
          return NextResponse.json(
            { success: false, error: 'Target school does not belong to your company' },
            { status: 403 }
          );
        }
      }
    }

    // 対象の子どもが管理下にあるかチェック（一括取得）
    let childrenQuery = supabase
      .from('m_children')
      .select('id, facility_id, school_id, family_name, given_name')
      .in('id', childIds)
      .is('deleted_at', null);

    if (role === 'facility_admin') {
      childrenQuery = childrenQuery.eq('facility_id', facilityId);
    } else if (role === 'company_admin') {
      // 自社施設の子どものみ（サブクエリの代わりにアプリ側でフィルター）
      const { data: companyFacilities, error: cfError } = await supabase
        .from('m_facilities')
        .select('id')
        .eq('company_id', company_id)
        .is('deleted_at', null);

      if (cfError) {
        console.error('Failed to fetch company facilities:', cfError);
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
      }

      const companyFacilityIds = (companyFacilities || []).map((f: { id: string }) => f.id);
      childrenQuery = childrenQuery.in('facility_id', companyFacilityIds);
    }
    // site_admin は全施設にアクセス可能なのでフィルターなし

    const { data: children, error: childrenError } = await childrenQuery;

    if (childrenError) {
      console.error('Failed to fetch children:', childrenError);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    if (!children || children.length === 0) {
      return NextResponse.json({ success: false, error: 'No accessible children found' }, { status: 404 });
    }

    // 指定されたchildIdsのうちアクセス可能なIDのみに絞る
    const accessibleChildIds = children.map((c: { id: string }) => c.id);
    const inaccessibleIds = childIds.filter(id => !accessibleChildIds.includes(id));
    if (inaccessibleIds.length > 0) {
      return NextResponse.json(
        { success: false, error: `No access to children: ${inaccessibleIds.join(', ')}` },
        { status: 403 }
      );
    }

    if (mode === 'preview') {
      return handlePreview({
        supabase,
        children,
        targetClassId,
        targetSchoolId,
        targetFacilityId,
      });
    }

    if (mode === 'commit') {
      return handleCommit({
        supabase,
        children,
        targetClassId,
        targetSchoolId,
        targetFacilityId,
        schoolYear: resolvedSchoolYear,
        role,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid mode' }, { status: 400 });
  } catch (error) {
    console.error('Unexpected error in POST /api/children/transfer:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

type ChildRow = {
  id: string;
  facility_id: string;
  school_id: string | null;
  family_name: string | null;
  given_name: string | null;
};

async function handlePreview({
  supabase,
  children,
  targetClassId,
  targetSchoolId,
  targetFacilityId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  children: ChildRow[];
  targetClassId?: string;
  targetSchoolId?: string;
  targetFacilityId?: string;
}): Promise<NextResponse> {
  const childIds = children.map(c => c.id);

  // 現在の学校ID・施設IDを収集
  const currentSchoolIds = [...new Set(children.filter(c => c.school_id).map(c => c.school_id as string))];
  const currentFacilityIds = [...new Set(children.map(c => c.facility_id))];

  // 現在のクラス情報・移動先情報・学校名・施設名を並列取得
  const [
    currentClassResult,
    targetClassResult,
    targetSchoolResult,
    targetFacilityResult,
    currentSchoolNamesResult,
    currentFacilityNamesResult,
  ] = await Promise.all([
    supabase
      .from('_child_class')
      .select('child_id, m_classes(id, name)')
      .in('child_id', childIds)
      .eq('is_current', true),
    targetClassId
      ? supabase.from('m_classes').select('id, name').eq('id', targetClassId).is('deleted_at', null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    targetSchoolId
      ? supabase.from('m_schools').select('id, name').eq('id', targetSchoolId).is('deleted_at', null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    targetFacilityId
      ? supabase.from('m_facilities').select('id, name').eq('id', targetFacilityId).is('deleted_at', null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    currentSchoolIds.length > 0
      ? supabase.from('m_schools').select('id, name').in('id', currentSchoolIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
    currentFacilityIds.length > 0
      ? supabase.from('m_facilities').select('id, name').in('id', currentFacilityIds).is('deleted_at', null)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }>, error: null }),
  ]);

  if (currentClassResult.error) {
    console.error('Failed to fetch current classes:', currentClassResult.error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }

  type ClassRow = { child_id: string; m_classes: Array<{ id: string; name: string }> | { id: string; name: string } | null };
  const currentClassMap = new Map<string, string | null>(
    ((currentClassResult.data || []) as ClassRow[]).map((cc) => {
      const cls = Array.isArray(cc.m_classes) ? cc.m_classes[0] : cc.m_classes;
      return [cc.child_id, cls?.name ?? null];
    })
  );

  type NameRow = { id: string; name: string };
  const currentSchoolNameMap = new Map<string, string>(
    ((currentSchoolNamesResult.data || []) as NameRow[]).map(s => [s.id, s.name])
  );
  const currentFacilityNameMap = new Map<string, string>(
    ((currentFacilityNamesResult.data || []) as NameRow[]).map(f => [f.id, f.name])
  );

  const targetClassName = (targetClassResult.data as NameRow | null)?.name ?? null;
  const targetSchoolName = (targetSchoolResult.data as NameRow | null)?.name ?? null;
  const targetFacilityName = (targetFacilityResult.data as NameRow | null)?.name ?? null;

  const previewChildren: ChildPreview[] = children.map((child) => {
    const name = formatName(
      [decryptOrFallback(child.family_name), decryptOrFallback(child.given_name)],
      ''
    );

    const currentClassName = currentClassMap.get(child.id) ?? null;
    const currentSchoolName = child.school_id ? (currentSchoolNameMap.get(child.school_id) ?? null) : null;
    const currentFacilityName = currentFacilityNameMap.get(child.facility_id) ?? '';

    return {
      child_id: child.id,
      name: name ?? '',
      current_class_name: currentClassName,
      current_school_name: currentSchoolName,
      current_facility_name: currentFacilityName,
      target_class_name: targetClassName,
      target_school_name: targetSchoolName,
      target_facility_name: targetFacilityName,
      changes: {
        class: !!targetClassId,
        school: !!targetSchoolId,
        facility: !!targetFacilityId,
      },
    };
  });

  return NextResponse.json({ success: true, data: { children: previewChildren } });
}

async function handleCommit({
  supabase,
  children,
  targetClassId,
  targetSchoolId,
  targetFacilityId,
  schoolYear,
  role,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  children: ChildRow[];
  targetClassId?: string;
  targetSchoolId?: string;
  targetFacilityId?: string;
  schoolYear: number;
  role: string;
}): Promise<NextResponse> {
  const childIds = children.map(c => c.id);
  const today = getCurrentDateJST();
  const errors: CommitError[] = [];
  let updatedCount = 0;

  try {
    // m_children の school_id 更新
    if (targetSchoolId) {
      const { error: schoolUpdateError } = await supabase
        .from('m_children')
        .update({ school_id: targetSchoolId })
        .in('id', childIds);

      if (schoolUpdateError) {
        console.error('Failed to update school_id:', schoolUpdateError);
        throw new Error('Failed to update school_id');
      }
    }

    // m_children の facility_id 更新（company_admin / site_admin のみ）
    if (targetFacilityId && (role === 'company_admin' || role === 'site_admin')) {
      const { error: facilityUpdateError } = await supabase
        .from('m_children')
        .update({ facility_id: targetFacilityId })
        .in('id', childIds);

      if (facilityUpdateError) {
        console.error('Failed to update facility_id:', facilityUpdateError);
        throw new Error('Failed to update facility_id');
      }
    }

    // クラス移動処理
    if (targetClassId) {
      // 現在のクラスレコードを終了
      const { error: endClassError } = await supabase
        .from('_child_class')
        .update({ is_current: false, ended_at: today })
        .in('child_id', childIds)
        .eq('is_current', true);

      if (endClassError) {
        console.error('Failed to end current class records:', endClassError);
        throw new Error('Failed to end current class records');
      }

      // 新しいクラスレコードを一括挿入
      const newClassRecords = childIds.map((childId) => ({
        child_id: childId,
        class_id: targetClassId,
        school_year: schoolYear,
        started_at: today,
        is_current: true,
      }));

      const { error: insertClassError } = await supabase
        .from('_child_class')
        .insert(newClassRecords);

      if (insertClassError) {
        console.error('Failed to insert new class records:', insertClassError);
        throw new Error('Failed to insert new class records');
      }
    }

    updatedCount = childIds.length;
  } catch (error) {
    // ロールバック: Supabaseはトランザクションをネイティブサポートしないため
    // エラー内容をすべての対象childIdに記録して返す
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    for (const childId of childIds) {
      errors.push({ child_id: childId, error: errorMessage });
    }
    updatedCount = 0;
  }

  const hasErrors = errors.length > 0;
  return NextResponse.json(
    {
      success: !hasErrors,
      data: {
        updated_count: updatedCount,
        errors,
      },
    },
    { status: hasErrors && updatedCount === 0 ? 500 : 200 }
  );
}
