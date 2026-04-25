import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_SEGMENT_LENGTH = 4;
const RECOVERY_CODE_SEGMENT_COUNT = 2;
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_HASH_ROUNDS = 10;

function buildRecoveryCodeSegment() {
  let segment = '';

  for (let index = 0; index < RECOVERY_CODE_SEGMENT_LENGTH; index += 1) {
    segment += RECOVERY_CODE_ALPHABET[randomInt(RECOVERY_CODE_ALPHABET.length)];
  }

  return segment;
}

export function normalizeRecoveryCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  return Array.from({ length: count }, () => (
    Array.from({ length: RECOVERY_CODE_SEGMENT_COUNT }, () => buildRecoveryCodeSegment()).join('-')
  ));
}

export async function hashRecoveryCodes(codes: string[]) {
  return Promise.all(
    codes.map((code) => bcrypt.hash(normalizeRecoveryCode(code), RECOVERY_CODE_HASH_ROUNDS)),
  );
}

export function parseStoredRecoveryCodeHashes(rawValue: string | null | undefined) {
  if (!rawValue) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [] as string[];
    }

    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch {
    return [] as string[];
  }
}

export function serializeRecoveryCodeHashes(hashes: string[]) {
  return hashes.length > 0 ? JSON.stringify(hashes) : null;
}

export async function consumeRecoveryCode(
  code: string,
  storedRecoveryCodeHashes: string | null | undefined,
): Promise<string[] | null> {
  const normalizedCode = normalizeRecoveryCode(code);
  if (!normalizedCode) {
    return null;
  }

  const recoveryCodeHashes = parseStoredRecoveryCodeHashes(storedRecoveryCodeHashes);
  for (let index = 0; index < recoveryCodeHashes.length; index += 1) {
    const currentHash = recoveryCodeHashes[index];
    if (await bcrypt.compare(normalizedCode, currentHash)) {
      return recoveryCodeHashes.filter((_, currentIndex) => currentIndex !== index);
    }
  }

  return null;
}