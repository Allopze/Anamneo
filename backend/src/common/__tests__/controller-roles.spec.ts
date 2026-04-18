import 'reflect-metadata';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PatientsController } from '../../patients/patients.controller';
import { ConditionsController } from '../../conditions/conditions.controller';

describe('controller role metadata', () => {
  it('marks patient list as explicit admin and clinician access', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PatientsController.prototype.findAll);
    expect(roles).toEqual(['ADMIN', 'MEDICO', 'ASISTENTE']);
  });

  it('marks patient duplicate checks as clinician-only', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PatientsController.prototype.findPossibleDuplicates);
    expect(roles).toEqual(['MEDICO', 'ASISTENTE']);
  });

  it('marks condition reads and suggestions with explicit access', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ConditionsController.prototype.findAll)).toEqual([
      'ADMIN',
      'MEDICO',
      'ASISTENTE',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, ConditionsController.prototype.findOne)).toEqual([
      'ADMIN',
      'MEDICO',
      'ASISTENTE',
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, ConditionsController.prototype.suggest)).toEqual([
      'ADMIN',
      'MEDICO',
      'ASISTENTE',
    ]);
  });
});