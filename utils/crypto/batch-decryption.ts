import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const LEGACY_IV_LENGTH = 16;
const LEGACY_AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 12;

/**
 * 暗号化キーを取得（1回だけ呼び出し、キャッシュして再利用）
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('PII_ENCRYPTION_KEY is not defined in environment variables');
  }

  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== 32) {
    throw new Error(
      `PII_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyBuffer.length} bytes`
    );
  }

  return keyBuffer;
}

/**
 * 単一の値を復号化（キーを引数で受け取る版）
 */
function decryptWithKey(encrypted: string, key: Buffer): string | null {
  try {
    if (!encrypted || encrypted.trim() === '') {
      return null;
    }

    const combinedBuffer = Buffer.from(encrypted, 'base64url');
    const legacyDecoded = combinedBuffer.toString('utf8');

    // レガシーフォーマットのチェック
    const legacyMatch = legacyDecoded.split(':');
    if (
      legacyMatch.length === 3 &&
      legacyMatch.every((part) => /^[0-9a-f]+$/i.test(part))
    ) {
      const [ivHex, authTagHex, encryptedData] = legacyMatch;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      if (iv.length !== LEGACY_IV_LENGTH || authTag.length !== LEGACY_AUTH_TAG_LENGTH) {
        return null;
      }

      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    }

    // 新フォーマット
    if (combinedBuffer.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
      return null;
    }

    const iv = combinedBuffer.subarray(0, IV_LENGTH);
    const authTag = combinedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = combinedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decryptedBuffer.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * 複数の暗号化された値を一括で復号化
 *
 * getEncryptionKey()の呼び出しを1回だけにすることで、
 * 大量の復号化処理を効率化します。
 *
 * @param encryptedValues - 暗号化された値の配列
 * @returns 暗号化された値をキー、復号化された値を値とするMap
 *
 * @example
 * ```typescript
 * const encrypted = ['abc123...', 'def456...', 'abc123...']; // 重複あり
 * const map = batchDecrypt(encrypted);
 * // Map { 'abc123...' => '田中', 'def456...' => '太郎' }
 * ```
 */
export function batchDecrypt(
  encryptedValues: Array<string | null | undefined>
): Map<string, string> {
  const results = new Map<string, string>();

  // 有効な値のみフィルタリング（nullや重複を除外）
  const uniqueValues = new Set<string>();
  for (const val of encryptedValues) {
    if (val && val.trim() !== '') {
      uniqueValues.add(val);
    }
  }

  if (uniqueValues.size === 0) {
    return results;
  }

  // キーを1回だけ取得
  const key = getEncryptionKey();

  // 各値を復号化
  for (const encrypted of uniqueValues) {
    const decrypted = decryptWithKey(encrypted, key);
    if (decrypted !== null) {
      results.set(encrypted, decrypted);
    } else {
      // 復号化失敗時は元の値を使用（後方互換性）
      results.set(encrypted, encrypted);
    }
  }

  return results;
}

/**
 * 子ども情報を一括で復号化
 *
 * @param children - 暗号化された子ども情報の配列
 * @returns 復号化された子ども情報の配列
 */
export function batchDecryptChildren<T extends {
  family_name?: string | null;
  given_name?: string | null;
  family_name_kana?: string | null;
  given_name_kana?: string | null;
}>(children: T[]): Array<T & {
  decrypted_family_name: string | null;
  decrypted_given_name: string | null;
  decrypted_family_name_kana: string | null;
  decrypted_given_name_kana: string | null;
}> {
  // すべての暗号化フィールドを収集
  const allEncrypted: Array<string | null | undefined> = [];
  for (const child of children) {
    allEncrypted.push(
      child.family_name,
      child.given_name,
      child.family_name_kana,
      child.given_name_kana
    );
  }

  // 一括復号化
  const decryptionMap = batchDecrypt(allEncrypted);

  // 復号化結果を適用
  return children.map(child => ({
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
 * 保護者電話番号を一括で復号化
 *
 * @param guardianLinks - 保護者リンク情報の配列
 * @returns child_idをキー、復号化された電話番号を値とするMap
 */
export function batchDecryptGuardianPhones(
  guardianLinks: Array<{
    child_id: string;
    is_primary?: boolean;
    guardian?: { phone?: string | null } | null;
  }>
): Map<string, string | null> {
  // すべての電話番号を収集
  const allPhones: Array<string | null | undefined> = guardianLinks
    .map(link => link.guardian?.phone)
    .filter(Boolean);

  // 一括復号化
  const decryptionMap = batchDecrypt(allPhones);

  // child_idごとにマッピング（主たる保護者を優先）
  const result = new Map<string, string | null>();
  for (const link of guardianLinks) {
    if (!link?.child_id) continue;
    const encryptedPhone = link.guardian?.phone ?? null;
    const decryptedPhone = encryptedPhone
      ? decryptionMap.get(encryptedPhone) ?? encryptedPhone
      : null;

    // 主たる保護者を優先
    if (!result.has(link.child_id) || link.is_primary) {
      result.set(link.child_id, decryptedPhone);
    }
  }

  return result;
}
