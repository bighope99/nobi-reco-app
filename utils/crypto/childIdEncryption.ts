import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 暗号化キーを取得
 * @throws {Error} 環境変数が設定されていない、または不正な長さの場合
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CHILD_ID_ENCRYPTION_KEY;

  if (!key) {
    throw new Error('CHILD_ID_ENCRYPTION_KEY is not defined in environment variables');
  }

  // 16進数文字列から32バイトのBufferに変換
  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== 32) {
    throw new Error(
      `CHILD_ID_ENCRYPTION_KEY must be 64 hex characters (32 bytes), got ${keyBuffer.length} bytes`
    );
  }

  return keyBuffer;
}

/**
 * 子供IDを暗号化してメンション用トークンを生成
 *
 * AES-256-GCMアルゴリズムを使用して子供IDを暗号化し、
 * URL-safeなBase64エンコードされたトークンを返します。
 *
 * @param childId - UUID形式の子供ID
 * @returns Base64url エンコードされた暗号化トークン
 * @throws {Error} 暗号化キーが設定されていない、または不正な場合
 *
 * @example
 * ```typescript
 * const childId = '550e8400-e29b-41d4-a716-446655440000';
 * const token = encryptChildId(childId);
 * console.log(token); // "AbCd123..."
 * ```
 */
export function encryptChildId(childId: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(childId, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  const combined = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

  // URL-safe Base64エンコード
  return Buffer.from(combined).toString('base64url');
}

/**
 * 暗号化トークンから子供IDを復号化
 *
 * encryptChildId で暗号化されたトークンを復号化して、
 * 元の子供IDを取得します。
 *
 * @param token - Base64url エンコードされた暗号化トークン
 * @returns 復号化された子供ID（UUID）、失敗時はnull
 *
 * @example
 * ```typescript
 * const token = 'AbCd123...';
 * const childId = decryptChildId(token);
 * if (childId) {
 *   console.log(childId); // "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 */
export function decryptChildId(token: string): string | null {
  try {
    if (!token || token.length === 0) {
      return null;
    }

    const key = getEncryptionKey();

    // Base64url デコード
    const combined = Buffer.from(token, 'base64url').toString('utf8');

    // Format: iv:authTag:encrypted
    const parts = combined.split(':');
    if (parts.length !== 3) {
      return null;
    }

    const [ivHex, authTagHex, encrypted] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      return null;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // 復号化エラー（改ざん、不正なトークン等）
    console.error('Failed to decrypt child ID:', error instanceof Error ? error.message : error);
    return null;
  }
}
