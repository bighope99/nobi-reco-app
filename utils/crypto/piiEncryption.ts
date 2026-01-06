import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 暗号化キーを取得
 * @throws {Error} 環境変数が設定されていない、または不正な長さの場合
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('PII_ENCRYPTION_KEY is not defined in environment variables');
  }

  // 16進数文字列から32バイトのBufferに変換
  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== 32) {
    throw new Error(
      `PII_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyBuffer.length} bytes`
    );
  }

  return keyBuffer;
}

/**
 * PIIフィールドを暗号化
 *
 * AES-256-GCMアルゴリズムを使用してPIIフィールドを暗号化し、
 * URL-safeなBase64エンコードされた文字列を返します。
 *
 * @param plaintext - 暗号化する平文（nullまたは空文字列の場合はnullを返す）
 * @returns Base64url エンコードされた暗号化文字列、失敗時はnull
 * @throws {Error} 暗号化キーが設定されていない、または不正な場合
 *
 * @example
 * ```typescript
 * const phone = '09012345678';
 * const encrypted = encryptPII(phone);
 * console.log(encrypted); // "AbCd123..."
 * ```
 */
export function encryptPII(plaintext: string | null | undefined): string | null {
  if (!plaintext || plaintext.trim() === '') {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    // URL-safe Base64エンコード
    return Buffer.from(combined).toString('base64url');
  } catch (error) {
    console.error('Failed to encrypt PII:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * 暗号化されたPIIフィールドを復号化
 *
 * encryptPII で暗号化された文字列を復号化して、
 * 元の平文を取得します。復号化に失敗した場合はnullを返します。
 *
 * @param encrypted - Base64url エンコードされた暗号化文字列
 * @returns 復号化された平文、失敗時はnull
 *
 * @example
 * ```typescript
 * const encrypted = 'AbCd123...';
 * const decrypted = decryptPII(encrypted);
 * if (decrypted) {
 *   console.log(decrypted); // "09012345678"
 * }
 * ```
 */
export function decryptPII(encrypted: string | null | undefined): string | null {
  try {
    if (!encrypted || encrypted.trim() === '') {
      return null;
    }

    const key = getEncryptionKey();

    // Base64url デコード
    const combined = Buffer.from(encrypted, 'base64url').toString('utf8');

    // Format: iv:authTag:encrypted
    const parts = combined.split(':');
    if (parts.length !== 3) {
      return null;
    }

    const [ivHex, authTagHex, encryptedData] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      return null;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // 復号化エラー（改ざん、不正な文字列、既存の平文データなど）
    // 後方互換性のため、エラーをスローせずnullを返す
    return null;
  }
}

/**
 * 検索用ハッシュを生成（SHA-256）
 *
 * 電話番号やメールアドレスの検索用に、正規化された値のSHA-256ハッシュを生成します。
 *
 * @param normalizedValue - 正規化された値（電話番号、メールアドレスなど）
 * @returns SHA-256ハッシュ（64文字の16進数文字列）、nullまたは空文字列の場合はnull
 *
 * @example
 * ```typescript
 * const phone = '09012345678';
 * const hash = generateSearchHash(phone);
 * console.log(hash); // "abc123..."
 * ```
 */
export function generateSearchHash(normalizedValue: string | null | undefined): string | null {
  if (!normalizedValue || normalizedValue.trim() === '') {
    return null;
  }

  return crypto.createHash('sha256').update(normalizedValue, 'utf8').digest('hex');
}

/**
 * 名前を正規化（検索用）
 *
 * 名前の部分一致検索用に、正規化された値を生成します。
 * 全角・半角の統一、空白の除去などを行います。
 *
 * @param name - 正規化する名前
 * @returns 正規化された名前、nullまたは空文字列の場合はnull
 *
 * @example
 * ```typescript
 * const name = '田中 太郎';
 * const normalized = normalizeNameForSearch(name);
 * console.log(normalized); // "田中太郎"
 * ```
 */
export function normalizeNameForSearch(name: string | null | undefined): string | null {
  if (!name || name.trim() === '') {
    return null;
  }

  // 全角スペース・半角スペースを除去
  return name.replace(/[\s\u3000]/g, '').trim();
}
