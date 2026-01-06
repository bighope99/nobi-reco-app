import { generateSearchHash, normalizeNameForSearch } from '@/utils/crypto/piiEncryption';
import { normalizePhone } from '@/lib/children/import-csv';

export type EntityType = 'child' | 'guardian';
export type SearchType = 'phone' | 'email' | 'name' | 'name_kana';

/**
 * 検索用ハッシュテーブルにインデックスを更新
 *
 * @param supabase - Supabaseクライアント
 * @param entityType - エンティティタイプ（'child' または 'guardian'）
 * @param entityId - エンティティID
 * @param searchType - 検索タイプ（'phone', 'email', 'name', 'name_kana'）
 * @param value - 検索対象の値（電話番号、メールアドレス、名前など）
 */
export async function updateSearchIndex(
  supabase: any,
  entityType: EntityType,
  entityId: string,
  searchType: SearchType,
  value: string | null | undefined
): Promise<void> {
  if (!entityId) {
    return;
  }
  if (!value || value.trim() === '') {
    // 値が空の場合はインデックスを削除
    await supabase
      .from('s_pii_search_index')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('search_type', searchType);
    return;
  }

  let searchHash: string | null = null;
  let normalizedValue: string | null = null;

  if (searchType === 'phone') {
    // 電話番号: 正規化してハッシュ化
    const normalized = normalizePhone(value);
    if (normalized) {
      searchHash = generateSearchHash(normalized);
      normalizedValue = normalized; // 完全一致検索用にも保存
    }
  } else if (searchType === 'email') {
    // メールアドレス: 小文字に変換してハッシュ化
    const normalized = value.toLowerCase().trim();
    searchHash = generateSearchHash(normalized);
    normalizedValue = normalized; // 完全一致検索用にも保存
  } else if (searchType === 'name' || searchType === 'name_kana') {
    // 名前・フリガナ: 正規化して部分一致検索用に保存
    normalizedValue = normalizeNameForSearch(value);
  }

  if (!searchHash && !normalizedValue) {
    // どちらも生成できない場合はインデックスを削除
    await supabase
      .from('s_pii_search_index')
      .delete()
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('search_type', searchType);
    return;
  }

  // インデックスを更新（upsert）
  await supabase
    .from('s_pii_search_index')
    .upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        search_type: searchType,
        search_hash: searchHash,
        normalized_value: normalizedValue,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'entity_type,entity_id,search_type',
      }
    );
}

/**
 * 電話番号でエンティティを検索
 *
 * @param supabase - Supabaseクライアント
 * @param entityType - エンティティタイプ
 * @param phone - 検索する電話番号
 * @returns マッチしたエンティティIDの配列
 */
export async function searchByPhone(
  supabase: any,
  entityType: EntityType,
  phone: string | null
): Promise<string[]> {
  if (!phone) {
    return [];
  }
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return [];
  }

  const hash = generateSearchHash(normalized);
  if (!hash) {
    return [];
  }

  const { data, error } = await supabase
    .from('s_pii_search_index')
    .select('entity_id')
    .eq('entity_type', entityType)
    .eq('search_type', 'phone')
    .eq('search_hash', hash);

  if (error) {
    console.error('Failed to search by phone:', error);
    return [];
  }

  return (data || []).map((row: { entity_id: string }) => row.entity_id);
}

/**
 * メールアドレスでエンティティを検索
 *
 * @param supabase - Supabaseクライアント
 * @param entityType - エンティティタイプ
 * @param email - 検索するメールアドレス
 * @returns マッチしたエンティティIDの配列
 */
export async function searchByEmail(
  supabase: any,
  entityType: EntityType,
  email: string | null
): Promise<string[]> {
  if (!email) {
    return [];
  }
  const normalized = email.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  const hash = generateSearchHash(normalized);
  if (!hash) {
    return [];
  }

  const { data, error } = await supabase
    .from('s_pii_search_index')
    .select('entity_id')
    .eq('entity_type', entityType)
    .eq('search_type', 'email')
    .eq('search_hash', hash);

  if (error) {
    console.error('Failed to search by email:', error);
    return [];
  }

  return (data || []).map((row: { entity_id: string }) => row.entity_id);
}

/**
 * 名前でエンティティを部分一致検索
 *
 * @param supabase - Supabaseクライアント
 * @param entityType - エンティティタイプ
 * @param searchType - 検索タイプ（'name' または 'name_kana'）
 * @param query - 検索クエリ
 * @returns マッチしたエンティティIDの配列
 */
export async function searchByName(
  supabase: any,
  entityType: EntityType,
  searchType: 'name' | 'name_kana',
  query: string
): Promise<string[]> {
  if (!query || query.trim() === '') {
    return [];
  }

  const normalizedQuery = normalizeNameForSearch(query);
  if (!normalizedQuery) {
    return [];
  }

  const { data, error } = await supabase
    .from('s_pii_search_index')
    .select('entity_id')
    .eq('entity_type', entityType)
    .eq('search_type', searchType)
    .ilike('normalized_value', `%${normalizedQuery}%`);

  if (error) {
    console.error('Failed to search by name:', error);
    return [];
  }

  return (data || []).map((row: { entity_id: string }) => row.entity_id);
}

/**
 * エンティティのすべての検索インデックスを削除
 *
 * @param supabase - Supabaseクライアント
 * @param entityType - エンティティタイプ
 * @param entityId - エンティティID
 */
export async function deleteSearchIndex(
  supabase: any,
  entityType: EntityType,
  entityId: string
): Promise<void> {
  await supabase
    .from('s_pii_search_index')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
}
