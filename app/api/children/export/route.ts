import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptOrEmpty } from '@/utils/crypto/decryption-helper';
import { CHILD_IMPORT_HEADERS } from '@/lib/children/import-csv';
import { getCurrentDateJST } from '@/lib/utils/timezone';

function formatGender(gender: string | null): string {
  if (!gender) return '';
  if (gender === 'female') return '女';
  if (gender === 'male') return '男';
  return gender === 'other' ? 'その他' : '';
}

function formatEnrollmentStatus(status: string | null): string {
  if (!status) return '';
  if (status === 'withdrawn') return '退所';
  if (status === 'suspended') return '休所';
  return status === 'enrolled' ? '在籍' : '';
}

function formatEnrollmentType(type: string | null): string {
  if (!type) return '';
  if (type === 'temporary') return '一時';
  if (type === 'spot') return 'スポット';
  return type === 'regular' ? '通年' : '';
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '';
  // Handle both ISO datetime and date-only formats
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value == null) return '';
  return value ? 'true' : 'false';
}

function escapeCsvField(value: string): string {
  const sanitized = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\n') || sanitized.includes('\r')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

// 電話番号をハイフン付きでフォーマットし、Excelの数値自動変換を防ぐ
function formatPhoneForCsv(value: string): string {
  if (!value) return '';
  // 数字のみ抽出（既にハイフン付きの場合も安全）
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 11) {
    // 携帯: 090-1234-5678
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    // 固定: 03-1234-5678
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  // その他: そのまま返す
  return digits || value;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, current_facility_id, company_id } = metadata;

    // ロールチェック: エクスポート権限のあるロールのみ許可
    if (!['site_admin', 'company_admin', 'facility_admin', 'staff'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // site_admin/company_admin はクエリパラメータからも施設IDを受け取れる（import と同様）
    const { searchParams } = new URL(request.url);
    const facilityIdQuery = searchParams.get('facility_id') || '';

    let facilityId: string;
    if (role === 'facility_admin' || role === 'staff') {
      // facility_admin/staff は自施設のみ
      if (!current_facility_id) {
        return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 });
      }
      facilityId = current_facility_id;
    } else {
      // site_admin/company_admin はクエリパラメータ → JWTの施設ID の優先順で取得
      facilityId = facilityIdQuery || current_facility_id || '';
    }

    if (!facilityId) {
      return NextResponse.json({ success: false, error: 'Facility not found' }, { status: 404 });
    }

    // 施設名を取得（ファイル名に使用）
    let facilityName = '';
    {
      let facilityQuery = supabase
        .from('m_facilities')
        .select('id, name')
        .eq('id', facilityId)
        .is('deleted_at', null);

      if (role === 'company_admin') {
        // company_adminのスコープチェック: 自社施設のみエクスポート可能
        facilityQuery = facilityQuery.eq('company_id', company_id);
      }

      const { data: facilityData, error: facilityError } = await facilityQuery.maybeSingle();

      if (role === 'company_admin' && (facilityError || !facilityData)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }

      facilityName = facilityData?.name || '';
    }

    // 児童一覧を取得（保護者・緊急連絡先含む）
    const { data: children, error: childrenError } = await supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        nickname,
        gender,
        birth_date,
        enrollment_status,
        enrollment_type,
        enrolled_at,
        withdrawn_at,
        allergies,
        child_characteristics,
        parent_characteristics,
        photo_permission_public,
        photo_permission_share,
        _child_guardian (
          relationship,
          is_primary,
          is_emergency_contact,
          m_guardians (
            family_name,
            given_name,
            phone,
            email,
            deleted_at
          )
        )
      `)
      .eq('facility_id', facilityId)
      .is('deleted_at', null)
      .order('family_name_kana', { ascending: true });

    if (childrenError) {
      console.error('Children export fetch error:', childrenError);
      return NextResponse.json({ success: false, error: 'Failed to fetch children' }, { status: 500 });
    }

    // CSV行を構築
    const csvRows: string[] = [];
    csvRows.push(CHILD_IMPORT_HEADERS.map(escapeCsvField).join(','));

    for (const child of children || []) {
      const guardians = (child._child_guardian || []).filter((g: any) => g.m_guardians && g.m_guardians.deleted_at === null);
      const primaryGuardian = guardians.find((g: any) => g.is_primary);
      const emergencyContacts = guardians
        .filter((g: any) => g.is_emergency_contact && !g.is_primary)
        .slice(0, 2);

      const decryptedFamilyName = decryptOrEmpty(child.family_name);
      const decryptedGivenName = decryptOrEmpty(child.given_name);
      // family_name_kana / given_name_kana は平文で保存されているため復号不要
      const decryptedFamilyNameKana = child.family_name_kana || '';
      const decryptedGivenNameKana = child.given_name_kana || '';

      // 保護者情報の復号化
      let parentName = '';
      let parentRelationship = '';
      let parentPhone = '';
      let parentEmail = '';
      if (primaryGuardian?.m_guardians) {
        const g = primaryGuardian.m_guardians as any;
        const gFamily = decryptOrEmpty(g.family_name);
        const gGiven = decryptOrEmpty(g.given_name);
        parentName = `${gFamily} ${gGiven}`.trim() || gFamily;
        parentRelationship = primaryGuardian.relationship || '';
        parentPhone = decryptOrEmpty(g.phone);
        parentEmail = decryptOrEmpty(g.email);
      }

      // 緊急連絡先の復号化
      const ecData: Array<{ name: string; relation: string; phone: string }> = [];
      for (const ec of emergencyContacts) {
        if (ec.m_guardians) {
          const ecG = ec.m_guardians as any;
          const ecFamily = decryptOrEmpty(ecG.family_name);
          const ecGiven = decryptOrEmpty(ecG.given_name);
          ecData.push({
            name: `${ecFamily} ${ecGiven}`.trim() || ecFamily,
            relation: ec.relationship || '',
            phone: decryptOrEmpty(ecG.phone),
          });
        }
      }

      // 電話番号フィールドはハイフン付きでフォーマット、その他は escapeCsvField
      const row = [
        escapeCsvField(child.id),
        escapeCsvField(decryptedFamilyName),
        escapeCsvField(decryptedGivenName),
        escapeCsvField(decryptedFamilyNameKana),
        escapeCsvField(decryptedGivenNameKana),
        escapeCsvField(child.nickname || ''),
        escapeCsvField(formatGender(child.gender)),
        escapeCsvField(child.birth_date || ''),
        escapeCsvField(formatEnrollmentStatus(child.enrollment_status)),
        escapeCsvField(formatEnrollmentType(child.enrollment_type)),
        escapeCsvField(formatDate(child.enrolled_at)),
        escapeCsvField(formatDate(child.withdrawn_at)),
        escapeCsvField(parentName),
        escapeCsvField(parentRelationship),
        formatPhoneForCsv(parentPhone),
        escapeCsvField(parentEmail),
        escapeCsvField(decryptOrEmpty(child.allergies)),
        escapeCsvField(decryptOrEmpty(child.child_characteristics)),
        escapeCsvField(decryptOrEmpty(child.parent_characteristics)),
        escapeCsvField(formatBoolean(child.photo_permission_public)),
        escapeCsvField(formatBoolean(child.photo_permission_share)),
        escapeCsvField(ecData[0]?.name || ''),
        escapeCsvField(ecData[0]?.relation || ''),
        formatPhoneForCsv(ecData[0]?.phone || ''),
        escapeCsvField(ecData[1]?.name || ''),
        escapeCsvField(ecData[1]?.relation || ''),
        formatPhoneForCsv(ecData[1]?.phone || ''),
      ];

      csvRows.push(row.join(','));
    }

    const csv = `\ufeff${csvRows.join('\r\n')}\r\n`;

    // ファイル名: YYYYMMDD_[施設名].csv
    const dateStr = getCurrentDateJST().replace(/-/g, '');
    const exportFileName = facilityName ? `${dateStr}_${facilityName}.csv` : `${dateStr}_児童データ.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(exportFileName)}`,
        'Cache-Control': 'private, no-store, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Children Export API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
