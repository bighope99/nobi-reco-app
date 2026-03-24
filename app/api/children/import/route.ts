import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { saveChild, type ChildPayload } from '@/app/api/children/save/route';
import { buildChildPayload, buildPreviewRow, normalizePhone, parseCsvText, type DuplicateInfo } from '@/lib/children/import-csv';
import { buildSiblingCandidateGroups, type ExistingSiblingRow, type IncomingSiblingRow, type RegisteredSiblingPair } from '@/lib/children/import-siblings';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { deleteSearchIndex, searchByName, searchByPhone, updateSearchIndex } from '@/utils/pii/searchIndex';

type ChildSnapshot = {
  child: Record<string, unknown>;
  guardianLinks: Array<{ guardian_id: string; relationship: string; is_primary: boolean; is_emergency_contact: boolean }>;
  classLinks: Array<{ class_id: string; school_year: number; started_at: string; is_current: boolean }>;
};

async function checkDuplicateChildren(
  supabase: any,
  facilityId: string,
  familyName: string,
  givenName: string,
  birthDate: string,
  excludeChildId?: string,
): Promise<DuplicateInfo[]> {
  const fullName = `${familyName} ${givenName}`.trim();
  if (!fullName || !birthDate) return [];

  // 検索インデックスから名前で候補を取得
  const candidateIds = await searchByName(supabase, 'child', 'name', fullName);
  if (candidateIds.length === 0) return [];

  // 候補の中から同施設・同生年月日のものを絞り込み
  const { data: matches, error } = await supabase
    .from('m_children')
    .select('id, family_name, given_name, birth_date')
    .eq('facility_id', facilityId)
    .eq('birth_date', birthDate)
    .in('id', candidateIds)
    .is('deleted_at', null);

  if (error) {
    // エラー時は重複チェック失敗として上位に伝播させる（サイレント無視しない）
    throw new Error(`重複チェックに失敗しました: ${error.message}`);
  }

  if (!matches || matches.length === 0) return [];

  // 自身を除外（上書きインポート時に自己一致を防止）
  const filtered = excludeChildId
    ? matches.filter((child: any) => child.id !== excludeChildId)
    : matches;

  return filtered.map((child: any) => ({
    child_id: child.id,
    name: formatName([decryptOrFallback(child.family_name), decryptOrFallback(child.given_name)], ''),
    birth_date: child.birth_date,
  }));
}

async function fetchExistingSiblingRows(
  supabase: any,
  facilityId: string,
  normalizedPhoneSet: Set<string>,
): Promise<ExistingSiblingRow[]> {
  if (normalizedPhoneSet.size === 0) return [];

  // 検索用ハッシュテーブルから電話番号で検索
  const allGuardianIds: string[] = [];
  for (const phone of normalizedPhoneSet) {
    const guardianIds = await searchByPhone(supabase, 'guardian', phone);
    allGuardianIds.push(...guardianIds);
  }

  if (allGuardianIds.length === 0) return [];

  // 該当する保護者を取得
  const { data: guardians, error } = await supabase
    .from('m_guardians')
    .select(
      `
      id,
      family_name,
      given_name,
      phone,
      _child_guardian (
        child_id,
        m_children (
          id,
          family_name,
          given_name,
          deleted_at
        )
      )
    `
    )
    .eq('facility_id', facilityId)
    .in('id', [...new Set(allGuardianIds)]);

  if (error) {
    console.error('Failed to fetch guardians for siblings:', error);
    return [];
  }

  // PIIフィールドを復号化（失敗時は平文として扱う - 後方互換性）

  const existingRows: ExistingSiblingRow[] = [];
  (guardians || []).forEach((guardian: any) => {
    const decryptedPhone = decryptOrFallback(guardian.phone);
    const phoneKey = normalizePhone(decryptedPhone || '');
    if (!phoneKey || !normalizedPhoneSet.has(phoneKey)) return;

    const decryptedFamilyName = decryptOrFallback(guardian.family_name);
    const decryptedGivenName = decryptOrFallback(guardian.given_name);
    const guardianName = `${decryptedFamilyName || ''} ${decryptedGivenName || ''}`.trim();
    const links = guardian._child_guardian || [];
    links.forEach((link: any) => {
      const child = link.m_children;
      if (!child || child.deleted_at) return;
      const decryptedChildFamilyName = decryptOrFallback(child.family_name);
      const decryptedChildGivenName = decryptOrFallback(child.given_name);
      const childName = `${decryptedChildFamilyName || ''} ${decryptedChildGivenName || ''}`.trim();
      existingRows.push({
        child_id: child.id,
        child_name: childName,
        guardian_name: guardianName,
        phone: decryptedPhone || '',
      });
    });
  });

  return existingRows;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const metadata = await getAuthenticatedUserMetadata();

    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const facilityId = (formData.get('facility_id') || '') as string;
    const schoolId = (formData.get('school_id') || '') as string;
    const classId = (formData.get('class_id') || '') as string;
    const mode = (formData.get('mode') || 'commit') as string;

    // 行ごとの学校・クラス設定（フロントから送られる場合はこちらを優先）
    let rowSettings: Array<{ school_id: string | null; class_id: string | null }> | null = null;
    const rowSettingsRaw = formData.get('row_settings');
    if (typeof rowSettingsRaw === 'string' && rowSettingsRaw.trim().length > 0) {
      try {
        const parsed = JSON.parse(rowSettingsRaw);
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { success: false, error: 'row_settings は JSON 配列である必要があります' },
            { status: 400 }
          );
        }
        rowSettings = parsed;
      } catch {
        return NextResponse.json(
          { success: false, error: 'row_settings の JSON 形式が無効です' },
          { status: 400 }
        );
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'CSVファイルが必要です' }, { status: 400 });
    }

    const { role, current_facility_id, company_id } = metadata;

    // facility_admin/staffは自施設のみ（フロントからのfacility_idパラメータを無視）
    let targetFacilityId: string;
    if (role === 'facility_admin' || role === 'staff') {
      if (!current_facility_id) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
      targetFacilityId = current_facility_id;
    } else {
      // site_admin/company_adminのみが施設パラメータを使用可能
      if (role !== 'site_admin' && role !== 'company_admin') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
      targetFacilityId = facilityId || current_facility_id || '';
    }

    if (!targetFacilityId) {
      return NextResponse.json({ success: false, error: '施設が未選択です' }, { status: 400 });
    }

    if (role === 'company_admin') {
      const { data: scopedFacility, error: scopeError } = await supabase
        .from('m_facilities')
        .select('id')
        .eq('id', targetFacilityId)
        .eq('company_id', company_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (scopeError || !scopedFacility) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    const [schoolCheck, classCheck] = await Promise.all([
      schoolId
        ? supabase
            .from('m_schools')
            .select('id')
            .eq('id', schoolId)
            .eq('facility_id', targetFacilityId)
            .is('deleted_at', null)
            .single()
        : Promise.resolve({ data: null, error: null }),
      classId
        ? supabase
            .from('m_classes')
            .select('id')
            .eq('id', classId)
            .eq('facility_id', targetFacilityId)
            .is('deleted_at', null)
            .single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (schoolId && (schoolCheck.error || !schoolCheck.data)) {
      return NextResponse.json({ success: false, error: '学校が見つかりません' }, { status: 400 });
    }

    if (classId && (classCheck.error || !classCheck.data)) {
      return NextResponse.json({ success: false, error: 'クラスが見つかりません' }, { status: 400 });
    }

    const text = await file.text();
    const { headers, rows } = parseCsvText(text);

    // フォーマット検証: 必須列の不足 または 廃止列の混入
    const REQUIRED_HEADERS = ['姓', '名', '生年月日', '入所日', '保護者氏名', '保護者電話'];
    const FORBIDDEN_HEADERS = ['学校名', 'クラス名'];
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    const foundForbidden = FORBIDDEN_HEADERS.filter((h) => headers.includes(h));
    if (missingHeaders.length > 0 || foundForbidden.length > 0) {
      const reasons: string[] = [];
      if (missingHeaders.length > 0) reasons.push(`必須列が不足しています: ${missingHeaders.join(', ')}`);
      if (foundForbidden.length > 0) reasons.push(`使用できない列が含まれています: ${foundForbidden.join(', ')}`);
      return NextResponse.json(
        {
          success: false,
          error: `CSVのフォーマットが正しくありません。${reasons.join('。')}。テンプレートをダウンロードして正しいフォーマットで作成してください。`,
        },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'CSVにデータがありません' }, { status: 400 });
    }

    const globalDefaults = {
      school_id: schoolId || null,
      class_id: classId || null,
    };

    // 承認済み重複行の取得（commitモード用）
    let approvedDuplicateRows: number[] = [];
    if (mode !== 'preview') {
      const approvedDuplicateRaw = formData.get('approved_duplicate_rows');
      if (typeof approvedDuplicateRaw === 'string' && approvedDuplicateRaw.trim().length > 0) {
        try {
          approvedDuplicateRows = JSON.parse(approvedDuplicateRaw) as number[];
          if (!Array.isArray(approvedDuplicateRows)) {
            return NextResponse.json(
              { success: false, error: 'approved_duplicate_rows は JSON 配列である必要があります' },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: 'approved_duplicate_rows の JSON 形式が無効です' },
            { status: 400 }
          );
        }
      }
    }

    const results: Array<{ row: number; success: boolean; message?: string }> = [];
    const previewRows: ReturnType<typeof buildPreviewRow>[] = [];
    const incomingSiblingRows: IncomingSiblingRow[] = [];
    let successCount = 0;
    let failureCount = 0;

    // commitモード: ロールバック用に登録済みchild_idを記録
    const insertedChildIds: string[] = [];
    // commitモード: 更新前のスナップショットを保持（ロールバック時に復元）
    const updatedSnapshots: ChildSnapshot[] = [];

    const rollbackInsertedChildren = async (): Promise<void> => {
      // 更新済みレコードをスナップショットから完全復元
      for (const snapshot of updatedSnapshots) {
        // m_children を元の状態に上書き復元
        const { error: restoreError } = await supabase
          .from('m_children')
          .update(snapshot.child)
          .eq('id', snapshot.child.id as string)
          .eq('facility_id', targetFacilityId);
        if (restoreError) {
          console.error('Failed to restore m_children snapshot:', restoreError);
          throw restoreError;
        }

        // _child_guardian を復元（一旦全削除して再挿入）
        const { error: guardianDeleteError } = await supabase
          .from('_child_guardian')
          .delete()
          .eq('child_id', snapshot.child.id as string);
        if (guardianDeleteError) {
          console.error('Failed to clear _child_guardian during rollback:', guardianDeleteError);
          throw guardianDeleteError;
        }
        if (snapshot.guardianLinks.length > 0) {
          const { error: guardianRestoreError } = await supabase
            .from('_child_guardian')
            .insert(snapshot.guardianLinks.map(l => ({ child_id: snapshot.child.id, ...l })));
          if (guardianRestoreError) {
            console.error('Failed to restore _child_guardian snapshot:', guardianRestoreError);
            throw guardianRestoreError;
          }
        }

        // _child_class を復元（一旦全削除して再挿入）
        const { error: classDeleteError } = await supabase
          .from('_child_class')
          .delete()
          .eq('child_id', snapshot.child.id as string);
        if (classDeleteError) {
          console.error('Failed to clear _child_class during rollback:', classDeleteError);
          throw classDeleteError;
        }
        if (snapshot.classLinks.length > 0) {
          const { error: classRestoreError } = await supabase
            .from('_child_class')
            .insert(snapshot.classLinks.map(l => ({ child_id: snapshot.child.id, ...l })));
          if (classRestoreError) {
            console.error('Failed to restore _child_class snapshot:', classRestoreError);
            throw classRestoreError;
          }
        }

        // 検索インデックスを更新（復元した child の名前で再構築）
        const familyName = snapshot.child.family_name as string | null;
        const givenName = snapshot.child.given_name as string | null;
        if (familyName && givenName) {
          const decryptedFamily = decryptOrFallback(familyName) || '';
          const decryptedGiven = decryptOrFallback(givenName) || '';
          await updateSearchIndex(supabase, 'child', snapshot.child.id as string, 'name', `${decryptedFamily} ${decryptedGiven}`.trim() || null);
        }
      }

      if (insertedChildIds.length === 0) return;

      // 1. child_id に紐づく guardian_id を取得（_child_guardian 経由）
      const { data: guardianLinks } = await supabase
        .from('_child_guardian')
        .select('guardian_id')
        .in('child_id', insertedChildIds);
      const guardianIds: string[] = (guardianLinks ?? []).map((l: { guardian_id: string }) => l.guardian_id);

      // 2. _child_guardian リンクを削除（子テーブル側から先に削除）
      const { error: linkError } = await supabase
        .from('_child_guardian')
        .delete()
        .in('child_id', insertedChildIds);
      if (linkError) {
        console.error('Failed to rollback _child_guardian:', linkError);
        throw linkError;
      }

      // 3. _child_class リンクを削除
      const { error: classLinkError } = await supabase
        .from('_child_class')
        .delete()
        .in('child_id', insertedChildIds);
      if (classLinkError) {
        console.error('Failed to rollback _child_class:', classLinkError);
        throw classLinkError;
      }

      // 4. child の検索インデックスを削除
      await Promise.all(
        insertedChildIds.map((id) => deleteSearchIndex(supabase, 'child', id))
      );

      // 5. 孤立した保護者（他の child に紐づいていないもの）を論理削除し、検索インデックスも削除
      if (guardianIds.length > 0) {
        const { data: remainingLinks } = await supabase
          .from('_child_guardian')
          .select('guardian_id')
          .in('guardian_id', guardianIds);
        const stillLinkedIds = new Set((remainingLinks ?? []).map((l: { guardian_id: string }) => l.guardian_id));
        const orphanGuardianIds = guardianIds.filter((id) => !stillLinkedIds.has(id));

        if (orphanGuardianIds.length > 0) {
          await Promise.all(
            orphanGuardianIds.map((id) => deleteSearchIndex(supabase, 'guardian', id))
          );
          const { error: guardianError } = await supabase
            .from('m_guardians')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', orphanGuardianIds);
          if (guardianError) {
            console.error('Failed to rollback m_guardians:', guardianError);
            throw guardianError;
          }
        }
      }

      // 6. m_children を論理削除
      const { error: childError } = await supabase
        .from('m_children')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', insertedChildIds);
      if (childError) {
        console.error('Failed to rollback m_children:', childError);
        throw childError;
      }
    };

    // rowSettingsのschool_id/class_idをfacilityスコープで検証
    if (rowSettings && rowSettings.length > 0) {
      const rowSchoolIds = [...new Set(rowSettings.map((r) => r.school_id).filter((id): id is string => !!id))];
      const rowClassIds = [...new Set(rowSettings.map((r) => r.class_id).filter((id): id is string => !!id))];

      if (rowSchoolIds.length > 0) {
        const { data: validSchools } = await supabase
          .from('m_schools')
          .select('id')
          .in('id', rowSchoolIds)
          .eq('facility_id', targetFacilityId)
          .is('deleted_at', null);
        const validSchoolIdSet = new Set((validSchools || []).map((s: { id: string }) => s.id));
        const invalidSchoolId = rowSchoolIds.find((id) => !validSchoolIdSet.has(id));
        if (invalidSchoolId) {
          return NextResponse.json({ success: false, error: '指定された学校が施設に属していません' }, { status: 400 });
        }
      }

      if (rowClassIds.length > 0) {
        const { data: validClasses } = await supabase
          .from('m_classes')
          .select('id')
          .in('id', rowClassIds)
          .eq('facility_id', targetFacilityId)
          .is('deleted_at', null);
        const validClassIdSet = new Set((validClasses || []).map((c: { id: string }) => c.id));
        const invalidClassId = rowClassIds.find((id) => !validClassIdSet.has(id));
        if (invalidClassId) {
          return NextResponse.json({ success: false, error: '指定されたクラスが施設に属していません' }, { status: 400 });
        }
      }
    }

    const validatedPayloads: Array<{ rowNumber: number; payload: ChildPayload }> = [];

    // CSV内重複検出用セット（key: 正規化姓名 + 生年月日）
    const seenInCsv = new Set<string>();
    // CSV内child_id重複検出用セット
    const seenIds = new Set<string>();

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      // 行ごとの設定があればそちらを優先、なければグローバルデフォルトを使用
      const rowOverride = rowSettings?.[i];
      const defaults = rowOverride
        ? {
            // null は「グローバルデフォルトを継承」、"" は「明示的に未設定」を表す
            school_id: rowOverride.school_id === null ? globalDefaults.school_id : (rowOverride.school_id ?? globalDefaults.school_id),
            class_id: rowOverride.class_id === null ? globalDefaults.class_id : (rowOverride.class_id ?? globalDefaults.class_id),
          }
        : globalDefaults;
      const { payload, errors } = buildChildPayload(rows[i], defaults);

      if (mode === 'preview') {
        // 重複検知（バリデーションエラーがない行のみ）
        let duplicates: DuplicateInfo[] = [];
        let csvDuplicate = false;
        if (errors.length === 0 && payload?.basic_info?.family_name && payload?.basic_info?.given_name && payload?.basic_info?.birth_date) {
          // CSV内のchild_id重複チェック
          if (payload.child_id) {
            if (seenIds.has(payload.child_id)) {
              errors.push('CSV内に同じIDが重複しています');
            } else {
              seenIds.add(payload.child_id);
            }
          }

          // CSV内の重複チェック
          const csvKey = `${payload.basic_info.family_name.trim()}_${payload.basic_info.given_name.trim()}_${payload.basic_info.birth_date}`;
          if (seenInCsv.has(csvKey)) {
            csvDuplicate = true;
          } else {
            seenInCsv.add(csvKey);
          }

          if (!csvDuplicate) {
            duplicates = await checkDuplicateChildren(
              supabase,
              targetFacilityId,
              payload.basic_info.family_name,
              payload.basic_info.given_name,
              payload.basic_info.birth_date,
              payload.child_id,
            );
          }
        }

        const previewRow = buildPreviewRow(rows[i], rowNumber, payload, errors);
        if (csvDuplicate) {
          previewRow.errors.push('重複: 同じCSV内に同姓同名・同生年月日の児童が存在します');
        } else if (duplicates.length > 0) {
          previewRow.duplicates = duplicates;
          previewRow.errors.push(`重複: 同姓同名・同生年月日の児童が${duplicates.length}名存在します（${duplicates.map(d => d.name).join(', ')}）`);
        }
        previewRows.push(previewRow);

        // 修正行（child_idあり）はすでにDBに存在するため、fetchExistingSiblingRowsで「既存」として取得される。
        // 重複して「新規」としても追加すると同一人物が二重表示されるため、新規行のみ追加する。
        if (payload && !payload.child_id && payload.contact?.parent_phone && payload.basic_info?.family_name && payload.basic_info?.given_name) {
          incomingSiblingRows.push({
            row: rowNumber,
            child_name: `${payload.basic_info.family_name} ${payload.basic_info.given_name}`.trim(),
            parent_name: payload.contact.parent_name || '',
            phone: payload.contact.parent_phone,
          });
        }
        if (errors.length > 0 || csvDuplicate || duplicates.length > 0) {
          failureCount += 1;
        } else {
          successCount += 1;
        }
        continue;
      }

      // commitモード パス1: バリデーション+重複チェック（DB書き込み前に全行チェック）
      if (!payload) {
        return NextResponse.json({
          success: false,
          error: `${rowNumber}行目にエラーがあるためインポートを中止しました: ${errors.join(', ')}`,
        }, { status: 400 });
      }

      // CSV内のchild_id重複チェック
      if (payload.child_id) {
        if (seenIds.has(payload.child_id)) {
          return NextResponse.json({
            success: false,
            error: `${rowNumber}行目: CSV内に同じIDが重複しています`,
          }, { status: 400 });
        }
        seenIds.add(payload.child_id);
      }

      if (payload.basic_info?.family_name && payload.basic_info?.given_name && payload.basic_info?.birth_date) {
        // CSV内の重複チェック
        const csvKey = `${payload.basic_info.family_name.trim()}_${payload.basic_info.given_name.trim()}_${payload.basic_info.birth_date}`;
        if (seenInCsv.has(csvKey)) {
          return NextResponse.json({
            success: false,
            error: `${rowNumber}行目: 同じCSV内に同姓同名・同生年月日の児童が存在するためインポートを中止しました`,
          }, { status: 400 });
        }
        seenInCsv.add(csvKey);

        if (!approvedDuplicateRows.includes(rowNumber)) {
          const duplicates = await checkDuplicateChildren(
            supabase,
            targetFacilityId,
            payload.basic_info.family_name,
            payload.basic_info.given_name,
            payload.basic_info.birth_date,
            payload.child_id,
          );
          if (duplicates.length > 0) {
            return NextResponse.json({
              success: false,
              error: `${rowNumber}行目に重複児童が存在するためインポートを中止しました`,
            }, { status: 400 });
          }
        }
      }

      validatedPayloads.push({ rowNumber, payload });
    }

    // 更新対象の child_id を一括収集
    const childIdsToUpdate = validatedPayloads
      .filter(v => v.payload.child_id)
      .map(v => v.payload.child_id as string);

    // スナップショット（m_children）一括取得
    const snapshotMap = new Map<string, ChildSnapshot>();
    if (childIdsToUpdate.length > 0) {
      const [{ data: childSnapshots, error: snapshotFetchError }, { data: guardianLinks, error: guardianLinkError }, { data: classLinks, error: classLinkError }] = await Promise.all([
        supabase
          .from('m_children')
          .select('*')
          .in('id', childIdsToUpdate)
          .eq('facility_id', targetFacilityId)
          .is('deleted_at', null),
        supabase
          .from('_child_guardian')
          .select('child_id, guardian_id, relationship, is_primary, is_emergency_contact')
          .in('child_id', childIdsToUpdate),
        supabase
          .from('_child_class')
          .select('child_id, class_id, school_year, started_at, is_current')
          .in('child_id', childIdsToUpdate),
      ]);

      if (snapshotFetchError || guardianLinkError || classLinkError) {
        const err = snapshotFetchError || guardianLinkError || classLinkError;
        return NextResponse.json(
          { success: false, error: `スナップショット取得に失敗しました: ${err!.message}` },
          { status: 500 }
        );
      }

      for (const child of childSnapshots || []) {
        snapshotMap.set(child.id as string, {
          child: child as Record<string, unknown>,
          guardianLinks: (guardianLinks || [])
            .filter((l: { child_id: string }) => l.child_id === child.id)
            .map((l: { guardian_id: string; relationship: string; is_primary: boolean; is_emergency_contact: boolean }) => ({ guardian_id: l.guardian_id, relationship: l.relationship, is_primary: l.is_primary, is_emergency_contact: l.is_emergency_contact })),
          classLinks: (classLinks || [])
            .filter((l: { child_id: string }) => l.child_id === child.id)
            .map((l: { class_id: string; school_year: number; started_at: string; is_current: boolean }) => ({ class_id: l.class_id, school_year: l.school_year, started_at: l.started_at, is_current: l.is_current })),
        });
      }
    }

    // commitモード パス2: 全行バリデーション通過後にDB書き込み
    for (const { rowNumber, payload } of validatedPayloads) {
      let response: Response;
      let json: { data?: { child_id?: string }; error?: string };
      try {
        // IDがある場合は既存レコードの上書き更新、ない場合は新規作成
        const targetChildId = payload.child_id || undefined;

        // saveChild を呼ぶ前に更新対象のスナップショットを保存（一括取得済み）
        if (payload.child_id) {
          const snapshot = snapshotMap.get(payload.child_id);
          if (snapshot) {
            updatedSnapshots.push(snapshot);
          }
        }

        response = await saveChild(payload, targetFacilityId, supabase, targetChildId, {
          skipParentLegacy: true,
        });
        json = await response.json();
      } catch (saveErr) {
        try {
          await rollbackInsertedChildren();
        } catch (rollbackErr) {
          console.error('Rollback failed after saveChild threw:', rollbackErr);
        }
        throw saveErr;
      }

      if (!response.ok) {
        failureCount += 1;
        results.push({
          row: rowNumber,
          success: false,
          message: json.error || '登録に失敗しました',
        });

        try {
          await rollbackInsertedChildren();
        } catch (rollbackErr) {
          console.error('Rollback failed after DB error:', rollbackErr);
          return NextResponse.json(
            { success: false, error: 'ロールバックに失敗しました。登録状況を確認してください。' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: false,
          error: `${rowNumber}行目の登録に失敗したためインポートを中止しました: ${json.error || '登録に失敗しました'}`,
        }, { status: 400 });
      }

      // 登録成功時はchild_idを記録
      if (json.data?.child_id) {
        if (!payload.child_id) {
          // 新規作成: ロールバック（soft delete）対象
          insertedChildIds.push(json.data.child_id);
        }
        // 更新: スナップショットは saveChild 呼び出し前に取得済み
      }

      successCount += 1;
      results.push({ row: rowNumber, success: true });
    }

    if (mode === 'preview') {
      const normalizedPhoneSet = new Set(
        incomingSiblingRows.map((row) => normalizePhone(row.phone)).filter(Boolean)
      );
      const existingSiblingRows = await fetchExistingSiblingRows(
        supabase,
        targetFacilityId,
        normalizedPhoneSet,
      );
      const existingChildIds = [...new Set(existingSiblingRows.map((r) => r.child_id))];
      let registeredPairs: RegisteredSiblingPair[] = [];
      if (existingChildIds.length > 0) {
        const { data: pairsData } = await supabase
          .from('_child_sibling')
          .select('child_id, sibling_id')
          .in('child_id', existingChildIds);
        registeredPairs = pairsData ?? [];
      }
      const siblingCandidates = buildSiblingCandidateGroups(incomingSiblingRows, existingSiblingRows, registeredPairs);

      return NextResponse.json({
        success: true,
        data: {
          total: rows.length,
          success_count: successCount,
          failure_count: failureCount,
          rows: previewRows,
          sibling_candidates: siblingCandidates,
        },
      });
    }

    const approvedKeysRaw = formData.get('approved_phone_keys');
    let approvedPhoneKeys: string[] = [];
    
    if (typeof approvedKeysRaw === 'string' && approvedKeysRaw.trim().length > 0) {
      try {
        approvedPhoneKeys = JSON.parse(approvedKeysRaw) as string[];
        if (!Array.isArray(approvedPhoneKeys)) {
          return NextResponse.json(
            { success: false, error: 'approved_phone_keys must be a JSON array' },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON format for approved_phone_keys' },
          { status: 400 }
        );
      }
    }

    if (approvedPhoneKeys.length > 0) {
      const approvedSet = new Set(approvedPhoneKeys);
      const existingSiblingRows = await fetchExistingSiblingRows(supabase, targetFacilityId, approvedSet);
      const approvedCandidates = buildSiblingCandidateGroups([], existingSiblingRows).filter((group) =>
        approvedSet.has(group.phone_key)
      );

      const siblingInserts: Array<{ child_id: string; sibling_id: string; relationship: string }> = [];
      approvedCandidates.forEach((group) => {
        const childIds = group.children
          .filter((child) => child.child_id)
          .map((child) => child.child_id as string);
        const uniqueIds = Array.from(new Set(childIds));
        for (let i = 0; i < uniqueIds.length; i += 1) {
          for (let j = i + 1; j < uniqueIds.length; j += 1) {
            siblingInserts.push({
              child_id: uniqueIds[i],
              sibling_id: uniqueIds[j],
              relationship: '兄弟',
            });
            siblingInserts.push({
              child_id: uniqueIds[j],
              sibling_id: uniqueIds[i],
              relationship: '兄弟',
            });
          }
        }
      });

      let siblingLinkWarning = false;
      if (siblingInserts.length > 0) {
        const { error: siblingError } = await supabase
          .from('_child_sibling')
          .upsert(siblingInserts, { onConflict: 'child_id,sibling_id' });
        if (siblingError) {
          console.error('Failed to create sibling links:', siblingError);
          siblingLinkWarning = true;
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          total: rows.length,
          success_count: successCount,
          failure_count: failureCount,
          results,
          sibling_link_warning: siblingLinkWarning,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        success_count: successCount,
        failure_count: failureCount,
        results,
        sibling_link_warning: false,
      },
    });
  } catch (error) {
    console.error('Children Import API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
