import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptOrFallback } from '@/utils/crypto/decryption-helper';

const exportHeaders = [
  'ID',
  '姓',
  '名',
  'セイ',
  'メイ',
  'ニックネーム',
  '性別',
  '生年月日',
  '入所状況',
  '入所種別',
  '入所日',
  '退所日',
  '保護者氏名',
  '保護者電話',
  '保護者メール',
  'アレルギー',
  '子どもの特性',
  '保護者の状況・要望',
  '写真公開許可',
  '写真共有許可',
  '緊急連絡先1_氏名',
  '緊急連絡先1_続柄',
  '緊急連絡先1_電話',
  '緊急連絡先2_氏名',
  '緊急連絡先2_続柄',
  '緊急連絡先2_電話',
];

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

    // company_adminのスコープチェック: 自社施設のみエクスポート可能
    if (role === 'company_admin') {
      const { data: scopedFacility, error: scopeError } = await supabase
        .from('m_facilities')
        .select('id')
        .eq('id', facilityId)
        .eq('company_id', company_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (scopeError || !scopedFacility) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
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
            email
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
    csvRows.push(exportHeaders.map(escapeCsvField).join(','));

    for (const child of children || []) {
      const guardians = child._child_guardian || [];
      const primaryGuardian = guardians.find((g: any) => g.is_primary);
      const emergencyContacts = guardians
        .filter((g: any) => g.is_emergency_contact && !g.is_primary)
        .slice(0, 2);

      const decryptedFamilyName = decryptOrFallback(child.family_name) || '';
      const decryptedGivenName = decryptOrFallback(child.given_name) || '';
      const decryptedFamilyNameKana = decryptOrFallback(child.family_name_kana) || '';
      const decryptedGivenNameKana = decryptOrFallback(child.given_name_kana) || '';

      // 保護者情報の復号化
      let parentName = '';
      let parentPhone = '';
      let parentEmail = '';
      if (primaryGuardian?.m_guardians) {
        const g = primaryGuardian.m_guardians as any;
        const gFamily = decryptOrFallback(g.family_name) || '';
        const gGiven = decryptOrFallback(g.given_name) || '';
        parentName = `${gFamily} ${gGiven}`.trim() || gFamily;
        parentPhone = decryptOrFallback(g.phone) || '';
        parentEmail = decryptOrFallback(g.email) || '';
      }

      // 緊急連絡先の復号化
      const ecData: Array<{ name: string; relation: string; phone: string }> = [];
      for (const ec of emergencyContacts) {
        if (ec.m_guardians) {
          const ecG = ec.m_guardians as any;
          const ecFamily = decryptOrFallback(ecG.family_name) || '';
          const ecGiven = decryptOrFallback(ecG.given_name) || '';
          ecData.push({
            name: `${ecFamily} ${ecGiven}`.trim() || ecFamily,
            relation: ec.relationship || '',
            phone: decryptOrFallback(ecG.phone) || '',
          });
        }
      }

      const row = [
        child.id,
        decryptedFamilyName,
        decryptedGivenName,
        decryptedFamilyNameKana,
        decryptedGivenNameKana,
        child.nickname || '',
        formatGender(child.gender),
        child.birth_date || '',
        formatEnrollmentStatus(child.enrollment_status),
        formatEnrollmentType(child.enrollment_type),
        formatDate(child.enrolled_at),
        formatDate(child.withdrawn_at),
        parentName,
        parentPhone,
        parentEmail,
        decryptOrFallback(child.allergies) || '',
        decryptOrFallback(child.child_characteristics) || '',
        decryptOrFallback(child.parent_characteristics) || '',
        formatBoolean(child.photo_permission_public),
        formatBoolean(child.photo_permission_share),
        ecData[0]?.name || '',
        ecData[0]?.relation || '',
        ecData[0]?.phone || '',
        ecData[1]?.name || '',
        ecData[1]?.relation || '',
        ecData[1]?.phone || '',
      ];

      csvRows.push(row.map(escapeCsvField).join(','));
    }

    const csv = `\ufeff${csvRows.join('\r\n')}\r\n`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('児童データ.csv')}`,
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
