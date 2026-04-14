export type Role = 'MEDICO' | 'ASISTENTE' | 'ADMIN';

export type InvitationStatus = 'PENDIENTE' | 'ACEPTADA' | 'REVOCADA' | 'EXPIRADA';

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  REVOCADA: 'Revocada',
  EXPIRADA: 'Expirada',
};

export const INVITATION_STATUS_STYLES: Record<InvitationStatus, string> = {
  PENDIENTE: 'border border-status-yellow/60 bg-status-yellow/30 text-accent-text',
  ACEPTADA: 'bg-status-green/20 text-status-green',
  REVOCADA: 'bg-surface-muted text-ink-secondary',
  EXPIRADA: 'border border-status-yellow/70 bg-status-yellow/40 text-accent-text',
};

export function formatInvitationDate(value: string) {
  return new Date(value).toLocaleString('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export interface UserInvitationResponse {
  id: string;
  email: string;
  role: Role;
  medicoId?: string | null;
  expiresAt: string;
  token: string;
  inviteUrl?: string | null;
  emailSent: boolean;
  emailError?: string | null;
}

export interface CreatedInvitationState {
  email: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string | null;
}

export interface AdminInvitationRow {
  id: string;
  email: string;
  role: Role;
  medicoId?: string | null;
  invitedById: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  email: string;
  nombre: string;
  role: Role;
  active: boolean;
  isAdmin?: boolean;
  medicoId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordError(password: string, required: boolean) {
  const value = password;

  if (!required && value.trim().length === 0) return null;
  if (value.length < 8) return 'Contraseña debe tener al menos 8 caracteres';
  if (value.length > 72) return 'Contraseña no puede exceder 72 caracteres';
  if (/\s/.test(value)) return 'Contraseña no puede contener espacios';
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
    return 'Contraseña debe contener mayúscula, minúscula y número';
  }

  return null;
}

export function getBrowserOrigin() {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

export const ROLE_LABELS: Record<Role, string> = {
  MEDICO: 'Médico',
  ASISTENTE: 'Asistente',
  ADMIN: 'Administrador',
};
