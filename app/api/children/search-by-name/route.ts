import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getAuthenticatedUserMetadata } from '@/lib/auth/jwt';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { searchByName } from '@/utils/pii/searchIndex';

// POST /api/children/search-by-name - 名前で児童検索
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
    const { name, child_id } = body;

    // バリデーション
    if (!name || name.trim().length < 1) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // s_pii_search_index から childId 検索（名前の部分一致）
    const childIds = await searchByName(supabase, 'child', 'name', name.trim());

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

    // 該当する児童を取得（施設スコープ）
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

    // フィルタリング（編集モードの場合は本人を除外）・PII復号してレスポンス整形
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
          guardian_contacts: [],
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
    console.error('Search by name API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
