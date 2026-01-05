import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { saveChild } from '@/app/api/children/save/route';
import { buildChildPayload, buildPreviewRow, parseCsvText } from '@/lib/children/import-csv';

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
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const rowNumber = i + 2;
      const { payload, errors } = buildChildPayload(rows[i], defaults);

      if (mode === 'preview') {
        previewRows.push(buildPreviewRow(rows[i], rowNumber, payload, errors));
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

      const response = await saveChild(payload, targetFacilityId, supabase);
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
      return NextResponse.json({
        success: true,
        data: {
          total: rows.length,
          success_count: successCount,
          failure_count: failureCount,
          rows: previewRows,
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
