import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ENCRYPTED_VALUE_PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

function deriveKey(secret: string) {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function isEncryptedSettingValue(value: string) {
  return value.startsWith(ENCRYPTED_VALUE_PREFIX);
}

export function resolveSettingsEncryptionSecrets(
  primarySecret?: string | null,
  keyringSecrets?: string | null,
) {
  const candidates = [primarySecret, ...(keyringSecrets ? keyringSecrets.split(',') : [])]
    .map((value) => value?.trim() || '')
    .filter((value) => value.length > 0);

  return [...new Set(candidates)];
}

export function encryptSettingValue(value: string, secret: string) {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_VALUE_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSettingValue(value: string, secret: string) {
  if (!isEncryptedSettingValue(value)) {
    return value;
  }

  const payload = value.slice(ENCRYPTED_VALUE_PREFIX.length);
  const [ivBase64, authTagBase64, encryptedBase64] = payload.split(':');

  if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
    throw new Error('Encrypted setting payload is malformed');
  }

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function decryptSettingValueWithSecrets(value: string, secrets: string[]) {
  if (!isEncryptedSettingValue(value)) {
    return {
      value,
      usedSecret: null,
      requiresRewrap: false,
    };
  }

  if (secrets.length === 0) {
    throw new Error('No encryption secrets configured');
  }

  const activeSecret = secrets[0];
  let lastError: Error | undefined;

  for (const secret of secrets) {
    try {
      const decrypted = decryptSettingValue(value, secret);
      return {
        value: decrypted,
        usedSecret: secret,
        requiresRewrap: secret !== activeSecret,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown decryption error');
    }
  }

  throw lastError ?? new Error('Unable to decrypt setting value with configured secrets');
}
