import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { searchByPhone } from '@/utils/pii/searchIndex';
import { normalizePhone } from '@/lib/children/import-csv';

// POST /api/children/search-siblings - 兄弟検索（電話番号ベース）
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック（JWT署名検証済みメタデータから取得）
    const metadata = await getAuthenticatedUserMetadata();
    if (!metadata) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { current_facility_id: facility_id } = metadata;
    if (!facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    // リクエストボディ取得
    const body = await request.json();
    const { phone, child_id } = body;

    // バリデーション
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // 電話番号の正規化
    const normalizedPhone = normalizePhone(phone);

    // guardian エンティティタイプで電話番号検索（phone は guardian でのみインデックスされている）
    const guardianIds = await searchByPhone(supabase, 'guardian', normalizedPhone);

    if (guardianIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          found: false,
          candidates: [],
          total_found: 0,
        },
      });
    }

    // 対象施設の guardian を取得し、linked child_ids を取得
    const { data: guardians, error: guardiansError } = await supabase
      .from('m_guardians')
      .select('id, _child_guardian(child_id)')
      .eq('facility_id', facility_id)
      .in('id', guardianIds)
      .is('deleted_at', null);

    if (guardiansError) {
      console.error('Guardians search error:', guardiansError);
      return NextResponse.json({ error: 'Failed to search guardians' }, { status: 500 });
    }

    const childIds = [...new Set(
      (guardians || []).flatMap((g: { _child_guardian: Array<{ child_id: string }> }) =>
        g._child_guardian.map((link) => link.child_id)
      )
    )];

    if (childIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          found: false,
          candidates: [],
          total_found: 0,
        },
      });
    }

    // 該当する児童を取得
    const { data: childrenData, error: childrenError } = await supabase
      .from('m_children')
      .select(`
        id,
        family_name,
        given_name,
        family_name_kana,
        given_name_kana,
        birth_date,
        enrollment_status,
        photo_url,
        parent_phone,
        _child_class (
          is_current,
          m_classes (
            id,
            name,
            age_group
          )
        )
      `)
      .eq('facility_id', facility_id)
      .eq('_child_class.is_current', true)
      .in('id', childIds)
      .is('deleted_at', null);

    if (childrenError) {
      console.error('Children search error:', childrenError);
      return NextResponse.json({ error: 'Failed to search children' }, { status: 500 });
    }

    // 各児童の保護者連絡先（緊急連絡先フラグあり、主保護者含む全件）を取得
    const filteredChildIds = childIds.filter((id) => !child_id || id !== child_id);

    let guardianContactsMap: Map<string, Array<{
      guardian_id: string;
      name: string;
      kana: string | null;
      phone: string;
      relation: string;
      is_primary: boolean;
    }>> = new Map();

    if (filteredChildIds.length > 0) {
      const { data: guardianLinksData, error: guardianLinksError } = await supabase
        .from('_child_guardian')
        .select(`
          child_id,
          relationship,
          is_primary,
          m_guardians (
            id,
            family_name,
            family_name_kana,
            given_name,
            given_name_kana,
            phone,
            deleted_at
          )
        `)
        .in('child_id', filteredChildIds)
        .eq('is_emergency_contact', true);

      if (guardianLinksError) {
        console.error('Guardian links search error:', guardianLinksError);
        return NextResponse.json({ error: 'Failed to load guardian contacts' }, { status: 500 });
      }

      for (const link of (guardianLinksData || []).filter((g: any) => g.m_guardians && g.m_guardians.deleted_at === null)) {
        const guardian = link.m_guardians as unknown as {
          id: string;
          family_name: string;
          family_name_kana: string | null;
          given_name: string;
          given_name_kana: string | null;
          phone: string;
          deleted_at: string | null;
        } | null;
        if (!guardian) continue;

        const childContacts = guardianContactsMap.get(link.child_id) || [];
        childContacts.push({
          guardian_id: guardian.id,
          name: formatName([
            decryptOrFallback(guardian.family_name),
            decryptOrFallback(guardian.given_name),
          ]) || '',
          kana: formatName([
            guardian.family_name_kana ? decryptOrFallback(guardian.family_name_kana) : null,
            guardian.given_name_kana ? decryptOrFallback(guardian.given_name_kana) : null,
          ]) || null,
          phone: decryptOrFallback(guardian.phone) || '',
          relation: link.relationship || '',
          is_primary: link.is_primary ?? false,
        });
        guardianContactsMap.set(link.child_id, childContacts);
      }
    }

    // フィルタリング（編集モードの場合は本人を除外）
    const candidates = (childrenData || [])
      .filter((child: any) => {
        if (child_id && child.id === child_id) return false; // 本人を除外
        return true;
      })
      .map((child: any) => {
      const classInfo = child._child_class?.[0]?.m_classes;

      // 年齢計算
      const birthDate = new Date(child.birth_date);
      const today = new Date();
      const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      // PIIフィールドを復号化
      const decryptedFamilyName = decryptOrFallback(child.family_name);
      const decryptedGivenName = decryptOrFallback(child.given_name);
      const decryptedFamilyNameKana = decryptOrFallback(child.family_name_kana);
      const decryptedGivenNameKana = decryptOrFallback(child.given_name_kana);

      return {
        child_id: child.id,
        name: formatName([decryptedFamilyName, decryptedGivenName]),
        kana: formatName([decryptedFamilyNameKana, decryptedGivenNameKana]),
        birth_date: child.birth_date,
        age,
        class_name: classInfo?.name || '',
        age_group: classInfo?.age_group || '',
        enrollment_status: child.enrollment_status,
        photo_url: child.photo_url,
        guardian_contacts: guardianContactsMap.get(child.id) || [],
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        found: candidates.length > 0,
        candidates,
        total_found: candidates.length,
      },
    });
  } catch (error) {
    console.error('Search Siblings API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
