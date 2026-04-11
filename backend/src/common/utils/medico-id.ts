import { ForbiddenException } from '@nestjs/common';

export type RequestUser = {
  id: string;
  email?: string;
  nombre?: string;
  role: string;
  isAdmin?: boolean;
  medicoId?: string | null;
  totpEnabled?: boolean;
};

/**
 * Returns the effective medicoId for the current user.
 * - MEDICO → own id
 * - ADMIN (isAdmin) → own id
 * - ASISTENTE → their assigned medicoId
 * - Otherwise → throws ForbiddenException
 */
export function getEffectiveMedicoId(user: RequestUser): string {
  if (!user) {
    throw new ForbiddenException('Usuario no autenticado');
  }

  if (user.role === 'MEDICO' || user.isAdmin) return user.id;
  if (user.role === 'ASISTENTE' && user.medicoId) return user.medicoId;

  throw new ForbiddenException('No tiene una instancia médica asignada');
}
