import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { saveChild } from '@/app/api/children/save/route';
import { buildChildPayload, buildPreviewRow, normalizePhone, parseCsvText } from '@/lib/children/import-csv';
import { buildSiblingCandidateGroups, type ExistingSiblingRow, type IncomingSiblingRow } from '@/lib/children/import-siblings';
import { decryptPII } from '@/utils/crypto/piiEncryption';
import { searchByPhone } from '@/utils/pii/searchIndex';

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
  const decryptOrFallback = (encrypted: string | null | undefined): string | null => {
    if (!encrypted) return null;
    const decrypted = decryptPII(encrypted);
    return decrypted !== null ? decrypted : encrypted;
  };

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

    const { role, current_facility_id } = metadata;
    const targetFacilityId = facilityId || current_facility_id;

    if (!targetFacilityId) {
      return NextResponse.json({ success: false, error: '施設が未選択です' }, { status: 400 });
    }

    if (
      (role === 'facility_admin' || role === 'staff') &&
      targetFacilityId !== current_facility_id
    ) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
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

    const results: Array<{ row: number; success: boolean; message?: string }> = [];
    const previewRows: ReturnType<typeof buildPreviewRow>[] = [];
    const incomingSiblingRows: IncomingSiblingRow[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const { payload, errors } = buildChildPayload(rows[i], defaults);

      if (mode === 'preview') {
        previewRows.push(buildPreviewRow(rows[i], rowNumber, payload, errors));
        if (payload?.contact?.parent_phone && payload?.basic_info?.family_name && payload?.basic_info?.given_name) {
          incomingSiblingRows.push({
            row: rowNumber,
            child_name: `${payload.basic_info.family_name} ${payload.basic_info.given_name}`.trim(),
            parent_name: payload.contact.parent_name || '',
            phone: payload.contact.parent_phone,
          });
        }
        if (errors.length > 0) {
          failureCount += 1;
        } else {
          successCount += 1;
        }
        continue;
      }

      if (!payload) {
        failureCount += 1;
        results.push({
          row: rowNumber,
          success: false,
          message: errors.join(', '),
        });
        continue;
      }

      const response = await saveChild(payload, targetFacilityId, supabase, undefined, {
        skipParentLegacy: true,
      });
      const json = await response.json();

      if (!response.ok) {
        failureCount += 1;
        results.push({
          row: rowNumber,
          success: false,
          message: json.error || '登録に失敗しました',
        });
        continue;
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
