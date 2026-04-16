import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../common/utils/medico-id';

export type EncounterReviewStatus = 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO';

export function canAccessEncounter(user: RequestUser, medicoId: string) {
  if (user.isAdmin) {
    return true;
  }

  if (user.role === 'MEDICO') {
    return user.id === medicoId;
  }

  if (user.role === 'ASISTENTE') {
    return user.medicoId === medicoId;
  }

  return false;
}

export function assertEncounterAccess(user: RequestUser, medicoId: string, message: string) {
  if (!canAccessEncounter(user, medicoId)) {
    throw new ForbiddenException(message);
  }
}

export function canEditEncounterCreatedBy(user: RequestUser, createdById: string) {
  return user.role === 'MEDICO' || user.id === createdById;
}

export function canApplyReviewStatus(user: RequestUser, reviewStatus: EncounterReviewStatus) {
  if (reviewStatus === 'LISTA_PARA_REVISION') {
    return user.role === 'ASISTENTE';
  }

  if (reviewStatus === 'REVISADA_POR_MEDICO' || reviewStatus === 'NO_REQUIERE_REVISION') {
    return user.role === 'MEDICO';
  }

  return false;
}

export function assertTreatingMedico(userId: string, medicoId: string, message: string) {
  if (userId !== medicoId) {
    throw new ForbiddenException(message);
  }
}