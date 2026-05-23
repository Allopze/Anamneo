import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (256 bits). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a prefixed string: `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`
 */
export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    PREFIX +
    iv.toString('base64') +
    ':' +
    authTag.toString('base64') +
    ':' +
    encrypted.toString('base64')
  );
}

/**
 * Decrypts a field previously encrypted with `encryptField`.
 * If the value doesn't start with the encryption prefix, it is returned as-is
 * (backward compatibility with existing unencrypted data).
 */
export function decryptField(value: string): string {
  if (!value.startsWith(PREFIX)) {
    return value;
  }

  const payload = value.slice(PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted field');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid authentication tag length');
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Returns true if encryption is configured (ENCRYPTION_KEY is set).
 */
export function isEncryptionEnabled(): boolean {
  const hex = process.env.ENCRYPTION_KEY;
  return !!hex && hex.length === 64;
}

// ---------------------------------------------------------------------------
// Binary helpers — used for app-level encryption of attachments and
// regulatory snapshots (Ley 21.719 Art 14 quinquies lit a).
// The envelope is JSON-friendly and stored next to the ciphertext on disk
// or in DB (e.g. Attachment.encryptionEnvelope).
// ---------------------------------------------------------------------------

export interface EncryptionEnvelope {
  alg: 'aes-256-gcm';
  v: 1;
  iv: string;   // base64
  tag: string;  // base64
}

export function encryptBuffer(plain: Buffer): { ciphertext: Buffer; envelope: EncryptionEnvelope } {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext,
    envelope: {
      alg: 'aes-256-gcm',
      v: 1,
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
    },
  };
}

export function decryptBuffer(ciphertext: Buffer, envelope: EncryptionEnvelope): Buffer {
  if (envelope.alg !== 'aes-256-gcm' || envelope.v !== 1) {
    throw new Error(`Unsupported encryption envelope: ${envelope.alg}/${envelope.v}`);
  }
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  if (tag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid authentication tag length');
  }
  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function isEncryptionEnvelope(value: unknown): value is EncryptionEnvelope {
  return (
    !!value
    && typeof value === 'object'
    && (value as EncryptionEnvelope).alg === 'aes-256-gcm'
    && (value as EncryptionEnvelope).v === 1
    && typeof (value as EncryptionEnvelope).iv === 'string'
    && typeof (value as EncryptionEnvelope).tag === 'string'
  );
}
