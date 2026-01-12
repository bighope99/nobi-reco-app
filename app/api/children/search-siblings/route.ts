import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getUserSession } from '@/lib/auth/session';
import { decryptOrFallback, formatName } from '@/utils/crypto/decryption-helper';
import { searchByPhone } from '@/utils/pii/searchIndex';
import { normalizePhone } from '@/lib/children/import-csv';

// POST /api/children/search-siblings - 兄弟検索（電話番号ベース）
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 認証チェック
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // セッション情報取得
    const userSession = await getUserSession(session.user.id);
    if (!userSession || !userSession.current_facility_id) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
    }

    const facility_id = userSession.current_facility_id;

    // リクエストボディ取得
    const body = await request.json();
    const { phone, child_id } = body;

    // バリデーション
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // 電話番号の正規化
    const normalizedPhone = normalizePhone(phone);

    // 検索用ハッシュテーブルから電話番号で検索
    const childIds = await searchByPhone(supabase, 'child', normalizedPhone);
    
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
        _child_class!inner (
          is_current,
          m_classes!inner (
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

    // PIIフィールドを復号化（失敗時は平文として扱う - 後方互換性）
  

    // フィルタリング（編集モードの場合は本人を除外）
    const candidates = (childrenData || [])
      .filter((child: any) => {
        if (child_id && child.id === child_id) return false; // 本人を除外
        return true;
      })
      .map((child: any) => {
      const classInfo = child._child_class[0]?.m_classes;

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
