/**
 * Scrub de PHI y credenciales en strings antes de enviarlos a Sentry / logs.
 * Defensa en profundidad: no debemos depender de que el codigo no incluya PHI
 * en mensajes de error; cuando Prisma o class-validator surfacean input crudo
 * lo redactamos.
 */

export const PHI_REDACTIONS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Chilean RUT (with or without dots, with verifier)
  { pattern: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g, replacement: '[RUT]' },
  // Email addresses
  { pattern: /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, replacement: '[EMAIL]' },
  // Long digit sequences (phones, IDs) - 8+ digits
  { pattern: /\b\d{8,}\b/g, replacement: '[DIGITS]' },
  // JSON-ish "fieldName": "value" for known credential fields
  {
    pattern: /"(smtpPassword|password|currentPassword|newPassword|passwordHash|totpCode|totpSecret|token|refreshToken|accessToken|tokenHash|csrf_token|csrfToken|recoveryCode)"\s*:\s*"[^"]*"/gi,
    replacement: '"$1":"[REDACTED]"',
  },
];

export function scrubPhi(value: string | undefined | null): string | undefined {
  if (!value) return value ?? undefined;
  let result = value;
  for (const { pattern, replacement } of PHI_REDACTIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
