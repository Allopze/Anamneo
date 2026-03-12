/**
 * Validates Chilean RUT (Rol Único Tributario)
 * Format: XX.XXX.XXX-X or XXXXXXXX-X
 */
export function validateRut(rut: string): { valid: boolean; formatted: string | null } {
  if (!rut || typeof rut !== 'string') {
    return { valid: false, formatted: null };
  }

  // Remove dots and hyphens, convert to uppercase
  const cleanRut = rut.replace(/[.\-]/g, '').toUpperCase();

  if (cleanRut.length < 2) {
    return { valid: false, formatted: null };
  }

  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1);

  if (!/^\d+$/.test(body)) {
    return { valid: false, formatted: null };
  }

  // Calculate verification digit
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  let expectedVerifier: string;

  if (remainder === 11) expectedVerifier = '0';
  else if (remainder === 10) expectedVerifier = 'K';
  else expectedVerifier = remainder.toString();

  const valid = verifier === expectedVerifier;

  if (!valid) {
    return { valid: false, formatted: null };
  }

  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { valid: true, formatted: `${formattedBody}-${verifier}` };
}
