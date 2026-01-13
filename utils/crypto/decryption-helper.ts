import { decryptPII } from './piiEncryption';

/**
 * 暗号化された値を復号し、失敗時は元の値を返す(後方互換性のため)
 *
 * この関数は、暗号化されたPIIデータを復号化しますが、
 * 復号化に失敗した場合(既存の平文データなど)は元の値をそのまま返します。
 * これにより、暗号化移行期間中も既存データが正常に動作します。
 *
 * @param encrypted - 暗号化された値またはプレーンテキスト
 * @returns 復号された値、または復号失敗時は元の値
 *
 * @example
 * ```typescript
 * // 暗号化されたデータの場合
 * const encrypted = 'AbCd123...';
 * const decrypted = decryptOrFallback(encrypted);
 * console.log(decrypted); // "09012345678"
 *
 * // 既存の平文データの場合(後方互換性)
 * const plaintext = '09012345678';
 * const result = decryptOrFallback(plaintext);
 * console.log(result); // "09012345678"
 *
 * // nullまたはundefinedの場合
 * const result = decryptOrFallback(null);
 * console.log(result); // null
 * ```
 */
export function decryptOrFallback(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  const decrypted = decryptPII(encrypted);
  return decrypted !== null ? decrypted : encrypted;
}

/**
 * 名前パーツを整形する共通関数
 *
 * 複数の名前パーツ(姓、名など)を結合し、空白をトリミングして整形します。
 * すべてのパーツが空の場合は指定された空値を返します。
 *
 * @param parts - 名前パーツの配列(姓、名など)
 * @param emptyValue - 空の場合に返す値(デフォルト: null)
 * @returns フォーマットされた名前、またはemptyValue
 *
 * @example
 * ```typescript
 * // 通常の使用
 * const fullName = formatName(['田中', '太郎']);
 * console.log(fullName); // "田中 太郎"
 *
 * // null/undefinedを含む場合
 * const fullName = formatName(['田中', null, '太郎']);
 * console.log(fullName); // "田中 太郎"
 *
 * // すべて空の場合
 * const fullName = formatName([null, '', undefined]);
 * console.log(fullName); // null
 *
 * // カスタム空値
 * const fullName = formatName([null, ''], '不明');
 * console.log(fullName); // "不明"
 * ```
 */
export function formatName(
  parts: Array<string | null | undefined>,
  emptyValue: string | null = null
): string | null {
  const cleaned = parts
    .map(part => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(' ') : emptyValue;
}
