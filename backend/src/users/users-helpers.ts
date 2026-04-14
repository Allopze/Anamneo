import { createHash } from 'crypto';

export const BCRYPT_ROUNDS = 12;
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function validateTemporaryPassword(password: string): string | null {
  const normalized = password.trim();
  if (normalized.length < 8) {
    return 'La contraseña temporal debe tener al menos 8 caracteres';
  }
  if (/\s/.test(normalized)) {
    return 'La contraseña temporal no puede contener espacios';
  }
  if (!/[A-Z]/.test(normalized) || !/[a-z]/.test(normalized) || !/[0-9]/.test(normalized)) {
    return 'La contraseña temporal debe contener mayúscula, minúscula y número';
  }
  return null;
}

export function validateRoleMedicoId(role: string, medicoId: string | null | undefined, context: 'create' | 'invitation') {
  if (role === 'ADMIN' && medicoId) {
    return 'Un administrador no puede tener medicoId asignado';
  }
  if ((role === 'MEDICO') && medicoId) {
    return 'Un médico no puede tener medicoId asignado';
  }
  if (role === 'ASISTENTE' && !medicoId && context === 'invitation') {
    return 'Un asistente invitado debe estar asignado a un médico';
  }
  return null;
}
