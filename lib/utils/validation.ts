/**
 * UUID v4 バリデーションユーティリティ
 */

/**
 * UUID v4 の正規表現パターン
 * 例: 550e8400-e29b-41d4-a716-446655440000
 */
export const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 文字列が有効なUUID v4かどうかを検証
 *
 * @param id - 検証するID文字列
 * @returns 有効なUUID v4の場合 true、それ以外は false
 *
 * @example
 * ```typescript
 * isValidUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidUUID('invalid-uuid'); // false
 * ```
 */
export function isValidUUID(id: string): boolean {
  return UUID_V4_PATTERN.test(id);
}

/**
 * 配列内の無効なUUID IDを返す
 *
 * @param ids - 検証するID配列
 * @returns 無効なUUIDの配列
 *
 * @example
 * ```typescript
 * const ids = ['550e8400-e29b-41d4-a716-446655440000', 'invalid-uuid', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'];
 * findInvalidUUIDs(ids); // ['invalid-uuid']
 * ```
 */
export function findInvalidUUIDs(ids: string[]): string[] {
  return ids.filter(id => !isValidUUID(id));
}
