const KEY_STORAGE_ID = 'anamneo:phi-session-key:v1';
const ENVELOPE_VERSION = 1;

type EncryptedEnvelope = {
  v: number;
  alg: 'AES-GCM';
  iv: string;
  ciphertext: string;
};

function getSubtleCrypto(): SubtleCrypto | null {
  return globalThis.crypto?.subtle ?? null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

async function importSessionKey(rawKey: Uint8Array): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  if (!subtle) throw new Error('WebCrypto no disponible');
  return subtle.importKey('raw', toArrayBuffer(rawKey), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function getOrCreateSessionKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const storage = getSessionStorage();
  if (!subtle || !storage) throw new Error('WebCrypto no disponible');

  const existing = storage.getItem(KEY_STORAGE_ID);
  if (existing) {
    return importSessionKey(base64ToBytes(existing));
  }

  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  storage.setItem(KEY_STORAGE_ID, bytesToBase64(rawKey));
  return importSessionKey(rawKey);
}

export function isEncryptedPhiEnvelope(value: unknown): value is EncryptedEnvelope {
  return (
    typeof value === 'object'
    && value !== null
    && (value as Partial<EncryptedEnvelope>).v === ENVELOPE_VERSION
    && (value as Partial<EncryptedEnvelope>).alg === 'AES-GCM'
    && typeof (value as Partial<EncryptedEnvelope>).iv === 'string'
    && typeof (value as Partial<EncryptedEnvelope>).ciphertext === 'string'
  );
}

export async function encryptPhiJson(value: unknown): Promise<EncryptedEnvelope> {
  const subtle = getSubtleCrypto();
  if (!subtle) throw new Error('WebCrypto no disponible');

  const key = await getOrCreateSessionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext);

  return {
    v: ENVELOPE_VERSION,
    alg: 'AES-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptPhiJson<T>(envelope: unknown): Promise<T | null> {
  if (!isEncryptedPhiEnvelope(envelope)) return null;

  const subtle = getSubtleCrypto();
  if (!subtle) return null;

  try {
    const key = await getOrCreateSessionKey();
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(envelope.iv)) },
      key,
      toArrayBuffer(base64ToBytes(envelope.ciphertext)),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}
