import { ForbiddenException } from '@nestjs/common';
import {
  roleHasFineGrainedAction,
  type FineGrainedAction,
} from '../../../../shared/fine-grained-permission-contract';
import type { RequestUser } from './medico-id';

export function assertFineGrainedAction(
  user: Pick<RequestUser, 'role'>,
  action: FineGrainedAction,
  message = 'No tiene permisos para ejecutar esta acción',
) {
  if (!roleHasFineGrainedAction(user.role, action)) {
    throw new ForbiddenException(message);
  }
}
