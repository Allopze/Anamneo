import { ForbiddenException } from '@nestjs/common';

export type RequestUser = { id: string; role: string; medicoId?: string | null };

/**
 * Returns the effective medicoId for the current user.
 * - MEDICO → own id
 * - ASISTENTE → their assigned medicoId
 * - Otherwise → throws ForbiddenException
 */
export function getEffectiveMedicoId(user: RequestUser): string {
  if (!user) {
    throw new ForbiddenException('Usuario no autenticado');
  }

  if (user.role === 'MEDICO') return user.id;
  if (user.role === 'ASISTENTE' && user.medicoId) return user.medicoId;

  throw new ForbiddenException('Asistente no asignado a un médico');
}
