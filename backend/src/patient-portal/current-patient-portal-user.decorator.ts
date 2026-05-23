import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { PatientPortalRequestUser } from './patient-portal.types';

export const CurrentPatientPortalUser = createParamDecorator(
  (data: keyof PatientPortalRequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.patientPortalUser as PatientPortalRequestUser;
    return data ? user?.[data] : user;
  },
);
