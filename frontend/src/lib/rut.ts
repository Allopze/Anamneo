/**
 * Validates a Chilean RUT (Rol Único Tributario).
 * Accepts formats: 12.345.678-9, 12345678-9, 123456789
 * Returns validation result with formatted RUT.
 */
export function validateRut(rut: string): { valid: boolean; formatted: string | null } {
  if (!rut || typeof rut !== 'string') {
    return { valid: false, formatted: null };
  }

  // Remove dots, hyphens, and spaces
  const cleaned = rut.replace(/[.\-\s]/g, '').toUpperCase();

  if (cleaned.length < 2) return { valid: false, formatted: null };

  const body = cleaned.slice(0, -1);
  const checkDigit = cleaned.slice(-1);

  // Body must be all digits
  if (!/^\d+$/.test(body)) return { valid: false, formatted: null };

  // Calculate check digit
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expected: string;
  if (remainder === 11) expected = '0';
  else if (remainder === 10) expected = 'K';
  else expected = String(remainder);

  const valid = checkDigit === expected;
  if (!valid) return { valid: false, formatted: null };

  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { valid: true, formatted: `${formattedBody}-${checkDigit}` };
}

/**
 * Formats a RUT string to the standard XX.XXX.XXX-X format.
 */
export function formatRut(rut: string): string {
  if (!rut) return '';

  const cleaned = rut.replace(/[.\-\s]/g, '').toUpperCase();
  if (cleaned.length < 2) return cleaned;

  const body = cleaned.slice(0, -1);
  const checkDigit = cleaned.slice(-1);

  // Add dots every 3 digits from the right
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formatted}-${checkDigit}`;
}
