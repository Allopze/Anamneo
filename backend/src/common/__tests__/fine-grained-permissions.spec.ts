import { ForbiddenException } from '@nestjs/common';
import { assertFineGrainedAction } from '../utils/fine-grained-permissions';

describe('fine-grained permission enforcement', () => {
  it.each([
    ['MEDICO', 'patient.create', true],
    ['MEDICO', 'encounter.complete', true],
    ['MEDICO', 'admin.maintenance', false],
    ['ASISTENTE', 'encounter.sign', false],
    ['ASISTENTE', 'attachment.upload', true],
    ['ADMIN', 'settings.manage', true],
    ['ADMIN', 'encounter.complete', false],
  ] as const)('checks %s access for %s', (role, action, allowed) => {
    const assertion = () => assertFineGrainedAction({ role }, action);
    if (allowed) {
      expect(assertion).not.toThrow();
    } else {
      expect(assertion).toThrow(ForbiddenException);
    }
  });
});
