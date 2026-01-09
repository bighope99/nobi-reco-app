import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null | undefined;
let warnedInvalidKey = false;

const getEncryptionKey = (): Buffer | null => {
  if (cachedKey !== undefined) {
    return cachedKey;
  }

  const key = process.env.PERSONAL_DATA_ENCRYPTION_KEY ?? process.env.CHILD_ID_ENCRYPTION_KEY;

  if (!key) {
    cachedKey = null;
    return cachedKey;
  }

  const keyBuffer = Buffer.from(key, 'hex');

  if (keyBuffer.length !== 32) {
    if (!warnedInvalidKey) {
      console.warn('PERSONAL_DATA_ENCRYPTION_KEY is invalid. Expected 64 hex characters.');
      warnedInvalidKey = true;
    }
    cachedKey = null;
    return cachedKey;
  }

  cachedKey = keyBuffer;
  return cachedKey;
};

const isHex = (value: string) => /^[0-9a-f]+$/i.test(value);

const tryDecodeEncrypted = (token: string) => {
  try {
    const combined = Buffer.from(token, 'base64url').toString('utf8');
    const parts = combined.split(':');
    if (parts.length !== 3) {
      return null;
    }

    const [ivHex, authTagHex, encrypted] = parts;
    if (
      ivHex.length !== IV_LENGTH * 2 ||
      authTagHex.length !== AUTH_TAG_LENGTH * 2 ||
      !isHex(ivHex) ||
      !isHex(authTagHex) ||
      !isHex(encrypted)
    ) {
      return null;
    }

    return { ivHex, authTagHex, encrypted };
  } catch {
    return null;
  }
};

export const decryptNameField = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const key = getEncryptionKey();
  if (!key) {
    return value;
  }

  const decoded = tryDecodeEncrypted(value);
  if (!decoded) {
    return value;
  }

  try {
    const iv = Buffer.from(decoded.ivHex, 'hex');
    const authTag = Buffer.from(decoded.authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(decoded.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.warn('Failed to decrypt name field:', error instanceof Error ? error.message : error);
    return value;
  }
};

export const formatFullName = (
  familyName: string | null | undefined,
  givenName: string | null | undefined
): string => {
  return [familyName, givenName].filter(Boolean).join(' ').trim();
};

export const getDecryptedFullName = (fields: {
  family_name?: string | null;
  given_name?: string | null;
}): string => {
  const familyName = decryptNameField(fields.family_name);
  const givenName = decryptNameField(fields.given_name);
  return formatFullName(familyName, givenName);
};

export const getDecryptedFullKana = (fields: {
  family_name_kana?: string | null;
  given_name_kana?: string | null;
}): string => {
  const familyNameKana = decryptNameField(fields.family_name_kana);
  const givenNameKana = decryptNameField(fields.given_name_kana);
  return formatFullName(familyNameKana, givenNameKana);
};
