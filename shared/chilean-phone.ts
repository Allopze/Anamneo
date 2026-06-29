/**
 * Chilean phone number utilities.
 *
 * Canonical form: +56NXXXXXXXX  (2 + 9 local digits = 12 chars total)
 *   - Mobile:  +569XXXXXXXX  (9 + 8 digits)
 *   - Fixed:   +562XXXXXXXX, +563XXXXXXXX, … (area-code digit + 8 digits)
 *
 * Accepted inputs:
 *   +56 9 1234 5678, 9 1234 5678, +56 2 2345 6789, 22345 6789, etc.
 *   Spaces, hyphens and dots are ignored.  Empty / whitespace → undefined (optional field).
 */

/**
 * Regex for the canonical form (+56 + 9 local digits, first digit 2-9).
 * Use this on the already-normalised value (after normalizeChileanPhone).
 */
export const CHILEAN_PHONE_REGEX = /^\+56[2-9]\d{8}$/;

/**
 * Normalises a raw phone string to canonical +56XXXXXXXXX form.
 *
 * Returns `undefined` when the input is empty/whitespace so that a
 * class-validator `@IsOptional` decorator will skip further validation.
 * Returns the trimmed original when the number cannot be reduced to a
 * 9-digit local number, letting `@Matches(CHILEAN_PHONE_REGEX)` reject it.
 */
export function normalizeChileanPhone(raw: string): string | undefined {
  if (!raw || raw.trim().length === 0) return undefined;

  // Strip separators and parentheses
  const cleaned = raw.replace(/[\s\-\.()]/g, '');

  // Remove leading +
  const withoutPlus = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;

  // Strip country code 56 when total length is exactly 11 digits (56 + 9 local)
  const local =
    withoutPlus.startsWith('56') && withoutPlus.length === 11
      ? withoutPlus.slice(2)
      : withoutPlus;

  // Valid local number: one digit [2-9] followed by 8 digits = 9 digits total
  if (/^[2-9]\d{8}$/.test(local)) {
    return `+56${local}`;
  }

  // Cannot normalise — return trimmed input (will fail CHILEAN_PHONE_REGEX)
  return raw.trim();
}

/**
 * Returns true when the value is empty (optional field) or is a valid
 * Chilean phone number in any common format.
 */
export function isValidChileanPhone(raw: string | null | undefined): boolean {
  if (raw == null || raw.trim().length === 0) return true;
  const normalized = normalizeChileanPhone(raw);
  return normalized === undefined || CHILEAN_PHONE_REGEX.test(normalized);
}
