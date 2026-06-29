import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../common/utils/medico-id';
import {
  canRoleEditEncounterRecord,
  canRoleUpdateEncounterReviewStatus,
} from '../../../shared/encounter-permission-contract';

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
  return canRoleEditEncounterRecord(user.role, user.id, createdById);
}

export function canApplyReviewStatus(user: RequestUser, reviewStatus: EncounterReviewStatus) {
  return canRoleUpdateEncounterReviewStatus(user.role, reviewStatus);
}

export function assertTreatingMedico(userId: string, medicoId: string, message: string) {
  if (userId !== medicoId) {
    throw new ForbiddenException(message);
  }
}
