/**
 * 復号化結果のメモリキャッシュ
 *
 * セキュリティ要件:
 * - 施設ID（facility_id）でキャッシュを完全に分離
 * - 短いTTL（60秒）でセキュリティリスクを軽減
 * - 最大エントリ数を制限してメモリリークを防止
 *
 * 使用方法:
 * - 必ず facility_id を指定してキャッシュにアクセス
 * - 他のページでも共通で使用可能
 */

import { decryptPII } from './piiEncryption';

// キャッシュ設定
const CACHE_TTL_MS = 60 * 1000; // 60秒
const MAX_ENTRIES_PER_FACILITY = 500; // 施設あたり最大500エントリ
const MAX_FACILITIES = 50; // 最大50施設（メモリ保護）

interface CacheEntry {
  value: string;
  expiresAt: number;
}

// 施設ごとのキャッシュを管理
// Map<facility_id, Map<encrypted_value, CacheEntry>>
const facilityCache = new Map<string, Map<string, CacheEntry>>();

// 施設のアクセス順序を追跡（LRU用）
const facilityAccessOrder: string[] = [];

/**
 * 施設のキャッシュを取得（なければ作成）
 */
function getFacilityCache(facilityId: string): Map<string, CacheEntry> {
  let cache = facilityCache.get(facilityId);

  if (!cache) {
    // 最大施設数を超えたら最古の施設を削除
    if (facilityCache.size >= MAX_FACILITIES) {
      const oldestFacility = facilityAccessOrder.shift();
      if (oldestFacility) {
        facilityCache.delete(oldestFacility);
      }
    }

    cache = new Map<string, CacheEntry>();
    facilityCache.set(facilityId, cache);
  }

  // アクセス順序を更新
  const index = facilityAccessOrder.indexOf(facilityId);
  if (index !== -1) {
    facilityAccessOrder.splice(index, 1);
  }
  facilityAccessOrder.push(facilityId);

  return cache;
}

/**
 * キャッシュから値を取得
 */
function getFromCache(facilityId: string, encrypted: string): string | null {
  const cache = facilityCache.get(facilityId);
  if (!cache) return null;

  const entry = cache.get(encrypted);
  if (!entry) return null;

  // 有効期限チェック
  if (Date.now() > entry.expiresAt) {
    cache.delete(encrypted);
    return null;
  }

  return entry.value;
}

/**
 * キャッシュに値を設定
 */
function setToCache(facilityId: string, encrypted: string, decrypted: string): void {
  const cache = getFacilityCache(facilityId);

  // 最大エントリ数を超えたら古いエントリを削除
  if (cache.size >= MAX_ENTRIES_PER_FACILITY) {
    // 最初のエントリを削除（簡易LRU）
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }

  cache.set(encrypted, {
    value: decrypted,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * 期限切れエントリを定期的にクリーンアップ
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();

  for (const [facilityId, cache] of facilityCache) {
    for (const [encrypted, entry] of cache) {
      if (now > entry.expiresAt) {
        cache.delete(encrypted);
      }
    }

    // 空になった施設キャッシュを削除
    if (cache.size === 0) {
      facilityCache.delete(facilityId);
      const index = facilityAccessOrder.indexOf(facilityId);
      if (index !== -1) {
        facilityAccessOrder.splice(index, 1);
      }
    }
  }
}

// 5分ごとにクリーンアップ（サーバーサイドのみ）
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * キャッシュ付き復号化（施設IDで分離）
 *
 * @param encrypted - 暗号化された値
 * @param facilityId - 施設ID（キャッシュ分離用）
 * @returns 復号された値、または復号失敗時は元の値
 *
 * @example
 * ```typescript
 * const decrypted = cachedDecryptOrFallback(child.family_name, facility_id);
 * ```
 */
export function cachedDecryptOrFallback(
  encrypted: string | null | undefined,
  facilityId: string
): string | null {
  if (!encrypted) return null;
  if (!facilityId) {
    // facility_idがない場合はキャッシュを使わず直接復号化
    const decrypted = decryptPII(encrypted);
    return decrypted !== null ? decrypted : encrypted;
  }

  // キャッシュチェック
  const cached = getFromCache(facilityId, encrypted);
  if (cached !== null) {
    return cached;
  }

  // 復号化
  const decrypted = decryptPII(encrypted);
  const result = decrypted !== null ? decrypted : encrypted;

  // キャッシュに保存
  setToCache(facilityId, encrypted, result);

  return result;
}

/**
 * バッチでキャッシュ付き復号化（施設IDで分離）
 *
 * @param encryptedValues - 暗号化された値の配列
 * @param facilityId - 施設ID（キャッシュ分離用）
 * @returns 暗号化された値をキー、復号化された値を値とするMap
 *
 * @example
 * ```typescript
 * const encrypted = ['abc123...', 'def456...'];
 * const map = cachedBatchDecrypt(encrypted, facility_id);
 * ```
 */
export function cachedBatchDecrypt(
  encryptedValues: Array<string | null | undefined>,
  facilityId: string
): Map<string, string> {
  const results = new Map<string, string>();

  if (!facilityId) {
    // facility_idがない場合はキャッシュなしで処理
    for (const val of encryptedValues) {
      if (val && val.trim() !== '' && !results.has(val)) {
        const decrypted = decryptPII(val);
        results.set(val, decrypted !== null ? decrypted : val);
      }
    }
    return results;
  }

  // 有効な値のみフィルタリング（nullや重複を除外）
  const uniqueValues = new Set<string>();
  for (const val of encryptedValues) {
    if (val && val.trim() !== '') {
      uniqueValues.add(val);
    }
  }

  // キャッシュヒットとミスを分離
  const cacheMisses: string[] = [];

  for (const encrypted of uniqueValues) {
    const cached = getFromCache(facilityId, encrypted);
    if (cached !== null) {
      results.set(encrypted, cached);
    } else {
      cacheMisses.push(encrypted);
    }
  }

  // キャッシュミスのみ復号化
  if (cacheMisses.length > 0) {
    for (const encrypted of cacheMisses) {
      const decrypted = decryptPII(encrypted);
      const result = decrypted !== null ? decrypted : encrypted;
      results.set(encrypted, result);
      setToCache(facilityId, encrypted, result);
    }
  }

  return results;
}

/**
 * 子ども情報をキャッシュ付きでバッチ復号化
 *
 * @param children - 暗号化された子ども情報の配列
 * @param facilityId - 施設ID（キャッシュ分離用）
 * @returns 復号化された子ども情報の配列
 */
export function cachedBatchDecryptChildren<
  T extends {
    family_name?: string | null;
    given_name?: string | null;
    family_name_kana?: string | null;
    given_name_kana?: string | null;
  },
>(
  children: T[],
  facilityId: string
): Array<
  T & {
    decrypted_family_name: string | null;
    decrypted_given_name: string | null;
    decrypted_family_name_kana: string | null;
    decrypted_given_name_kana: string | null;
  }
> {
  // すべての暗号化フィールドを収集
  const allEncrypted: Array<string | null | undefined> = [];
  for (const child of children) {
    allEncrypted.push(child.family_name, child.given_name, child.family_name_kana, child.given_name_kana);
  }

  // 一括復号化（キャッシュ活用）
  const decryptionMap = cachedBatchDecrypt(allEncrypted, facilityId);

  // 復号化結果を適用
  return children.map((child) => ({
    ...child,
    decrypted_family_name: child.family_name
      ? decryptionMap.get(child.family_name) ?? child.family_name
      : null,
    decrypted_given_name: child.given_name
      ? decryptionMap.get(child.given_name) ?? child.given_name
      : null,
    decrypted_family_name_kana: child.family_name_kana
      ? decryptionMap.get(child.family_name_kana) ?? child.family_name_kana
      : null,
    decrypted_given_name_kana: child.given_name_kana
      ? decryptionMap.get(child.given_name_kana) ?? child.given_name_kana
      : null,
  }));
}

/**
 * 保護者電話番号をキャッシュ付きでバッチ復号化
 *
 * @param guardianLinks - 保護者リンク情報の配列
 * @param facilityId - 施設ID（キャッシュ分離用）
 * @returns child_idをキー、復号化された電話番号を値とするMap
 */
export function cachedBatchDecryptGuardianPhones(
  guardianLinks: Array<{
    child_id: string;
    is_primary?: boolean;
    guardian?: { phone?: string | null } | null;
  }>,
  facilityId: string
): Map<string, string | null> {
  // すべての電話番号を収集
  const allPhones: Array<string | null | undefined> = guardianLinks
    .map((link) => link.guardian?.phone)
    .filter(Boolean);

  // 一括復号化（キャッシュ活用）
  const decryptionMap = cachedBatchDecrypt(allPhones, facilityId);

  // child_idごとにマッピング（主たる保護者を優先）
  const result = new Map<string, string | null>();
  for (const link of guardianLinks) {
    if (!link?.child_id) continue;
    const encryptedPhone = link.guardian?.phone ?? null;
    const decryptedPhone = encryptedPhone ? decryptionMap.get(encryptedPhone) ?? encryptedPhone : null;

    // 主たる保護者を優先
    if (!result.has(link.child_id) || link.is_primary) {
      result.set(link.child_id, decryptedPhone);
    }
  }

  return result;
}

/**
 * 特定の施設のキャッシュをクリア
 *
 * @param facilityId - 施設ID
 */
export function clearFacilityCache(facilityId: string): void {
  facilityCache.delete(facilityId);
  const index = facilityAccessOrder.indexOf(facilityId);
  if (index !== -1) {
    facilityAccessOrder.splice(index, 1);
  }
}

/**
 * 全キャッシュをクリア
 */
export function clearAllCache(): void {
  facilityCache.clear();
  facilityAccessOrder.length = 0;
}

/**
 * キャッシュ統計を取得（デバッグ用）
 */
export function getCacheStats(): {
  facilityCount: number;
  totalEntries: number;
  facilitiesStats: Array<{ facilityId: string; entryCount: number }>;
} {
  const facilitiesStats: Array<{ facilityId: string; entryCount: number }> = [];
  let totalEntries = 0;

  for (const [facilityId, cache] of facilityCache) {
    facilitiesStats.push({ facilityId, entryCount: cache.size });
    totalEntries += cache.size;
  }

  return {
    facilityCount: facilityCache.size,
    totalEntries,
    facilitiesStats,
  };
}
