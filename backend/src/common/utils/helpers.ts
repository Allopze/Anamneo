/**
 * Validates Chilean RUT (Rol Único Tributario)
 * Format: XX.XXX.XXX-X or XXXXXXXX-X
 */
export function validateRut(rut: string): { valid: boolean; formatted: string | null } {
  if (!rut || typeof rut !== 'string') {
    return { valid: false, formatted: null };
  }

  // Remove dots, hyphens, and spaces, then convert to uppercase
  const cleanRut = rut.replace(/[.\-\s]/g, '').toUpperCase();

  // Check minimum length
  if (cleanRut.length < 2) {
    return { valid: false, formatted: null };
  }

  // Separate number and verification digit
  const body = cleanRut.slice(0, -1);
  const verifier = cleanRut.slice(-1);

  // Validate body is numeric
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

  if (remainder === 11) {
    expectedVerifier = '0';
  } else if (remainder === 10) {
    expectedVerifier = 'K';
  } else {
    expectedVerifier = remainder.toString();
  }

  const valid = verifier === expectedVerifier;

  if (!valid) {
    return { valid: false, formatted: null };
  }

  // Format with dots and hyphen
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = `${formattedBody}-${verifier}`;

  return { valid: true, formatted };
}

/**
 * Sanitizes string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

/**
 * Calculates BMI from weight (kg) and height (cm)
 */
export function calculateBMI(weightKg: number, heightCm: number): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) {
    return null;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  return Math.round(bmi * 10) / 10;
}
