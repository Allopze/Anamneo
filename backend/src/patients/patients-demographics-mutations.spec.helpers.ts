import { RequestUser } from '../common/utils/medico-id';

export const medicoUser: RequestUser = {
  id: 'med-1',
  role: 'MEDICO',
  isAdmin: false,
};

export const adminUser: RequestUser = {
  id: 'admin-1',
  role: 'ADMIN',
  isAdmin: true,
};

export function buildExistingPatient() {
  return {
    id: 'patient-1',
    createdById: 'med-1',
    createdBy: { medicoId: 'med-1' },
    archivedAt: null,
    rut: '11.111.111-1',
    rutExempt: false,
    rutExemptReason: null,
    nombre: 'Paciente Demo',
    fechaNacimiento: new Date('1990-05-10T00:00:00.000Z'),
    edad: 34,
    edadMeses: null,
    sexo: 'MASCULINO',
    prevision: 'FONASA',
    trabajo: 'Trabajo anterior',
    domicilio: 'Domicilio anterior',
    centroMedico: 'Centro Base',
    completenessStatus: 'VERIFICADA',
    demographicsVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    demographicsVerifiedById: 'med-1',
    history: { id: 'history-1' },
  };
}
