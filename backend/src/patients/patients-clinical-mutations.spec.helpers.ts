import { RequestUser } from '../common/utils/medico-id';

export const medicoUser: RequestUser = {
  id: 'med-1',
  role: 'MEDICO',
  isAdmin: false,
};

export function buildTaskInScope(medicoId: string) {
  return {
    id: 'task-1',
    patientId: 'patient-1',
    encounterId: 'enc-1',
    createdById: 'med-1',
    medicoId,
    title: 'Seguimiento inicial',
    details: null,
    type: 'SEGUIMIENTO',
    priority: 'MEDIA',
    status: 'PENDIENTE',
    recurrenceRule: 'NONE',
    recurrenceSourceTaskId: null,
    dueDate: null,
    completedAt: null,
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
    updatedAt: new Date('2026-01-10T12:00:00.000Z'),
    patient: { archivedAt: null },
    encounter: { medicoId },
    createdBy: { id: 'med-1', nombre: 'Dra. Demo', medicoId },
  };
}
