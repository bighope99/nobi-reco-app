import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { saveChild, type ChildPayload } from '@/app/api/children/save/route';
import { buildChildPayload, buildPreviewRow, normalizePhone, parseCsvText, type DuplicateInfo } from '@/lib/children/import-csv';
import { buildSiblingCandidateGroups, type ExistingSiblingRow, type IncomingSiblingRow } from '@/lib/children/import-siblings';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { deleteSearchIndex, searchByName, searchByPhone } from '@/utils/pii/searchIndex';

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

  if (error || !matches || matches.length === 0) return [];

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
    const { rows } = parseCsvText(text);

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'CSVにデータがありません' }, { status: 400 });
    }

    const defaults = {
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
              { success: false, error: 'approved_duplicate_rows must be a JSON array' },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid JSON format for approved_duplicate_rows' },
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

    const rollbackInsertedChildren = async (): Promise<void> => {
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

    const validatedPayloads: Array<{ rowNumber: number; payload: ChildPayload }> = [];

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const { payload, errors } = buildChildPayload(rows[i], defaults);

      if (mode === 'preview') {
        // 重複検知（バリデーションエラーがない行のみ）
        let duplicates: DuplicateInfo[] = [];
        if (errors.length === 0 && payload?.basic_info?.family_name && payload?.basic_info?.given_name && payload?.basic_info?.birth_date) {
          duplicates = await checkDuplicateChildren(
            supabase,
            targetFacilityId,
            payload.basic_info.family_name,
            payload.basic_info.given_name,
            payload.basic_info.birth_date,
            payload.child_id,
          );
        }

        const previewRow = buildPreviewRow(rows[i], rowNumber, payload, errors);
        if (duplicates.length > 0) {
          previewRow.duplicates = duplicates;
          previewRow.errors.push(`重複: 同姓同名・同生年月日の児童が${duplicates.length}名存在します（${duplicates.map(d => d.name).join(', ')}）`);
        }
        previewRows.push(previewRow);

        if (payload?.contact?.parent_phone && payload?.basic_info?.family_name && payload?.basic_info?.given_name) {
          incomingSiblingRows.push({
            row: rowNumber,
            child_name: `${payload.basic_info.family_name} ${payload.basic_info.given_name}`.trim(),
            parent_name: payload.contact.parent_name || '',
            phone: payload.contact.parent_phone,
          });
        }
        if (errors.length > 0 || (duplicates.length > 0)) {
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

      if (payload.basic_info?.family_name && payload.basic_info?.given_name && payload.basic_info?.birth_date) {
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

    // commitモード パス2: 全行バリデーション通過後にDB書き込み
    for (const { rowNumber, payload } of validatedPayloads) {
      let response: Response;
      let json: { data?: { child_id?: string }; error?: string };
      try {
        // IDがある場合は既存レコードの上書き更新、ない場合は新規作成
        const targetChildId = payload.child_id || undefined;
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

      // 登録成功時はchild_idを記録（新規作成分のみロールバック対象）
      if (!payload.child_id && json.data?.child_id) {
        insertedChildIds.push(json.data.child_id);
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
      const siblingCandidates = buildSiblingCandidateGroups(incomingSiblingRows, existingSiblingRows);

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

      if (siblingInserts.length > 0) {
        const { error: siblingError } = await supabase
          .from('_child_sibling')
          .upsert(siblingInserts, { onConflict: 'child_id,sibling_id' });
        if (siblingError) {
          console.error('Failed to create sibling links:', siblingError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: rows.length,
        success_count: successCount,
        failure_count: failureCount,
        results,
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
