import { getPatientOperationalHistoryReadModel } from './patients-operational-history-read-model';

describe('patients-operational-history-read-model', () => {
  it('builds a compact operational history from patient and encounter audit events', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'enc-1', createdAt: new Date('2026-04-18T09:00:00.000Z') },
        ]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'audit-restore',
            entityType: 'PatientRestore',
            entityId: 'patient-1',
            userId: 'med-1',
            reason: 'PATIENT_RESTORED',
            diff: JSON.stringify({ restoredEncounterCount: 1 }),
            timestamp: new Date('2026-04-18T10:00:00.000Z'),
          },
          {
            id: 'audit-reopen',
            entityType: 'Encounter',
            entityId: 'enc-1',
            userId: 'med-1',
            reason: 'ENCOUNTER_REOPENED',
            diff: JSON.stringify({ scope: 'PATIENT_RESTORE' }),
            timestamp: new Date('2026-04-18T10:01:00.000Z'),
          },
        ]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'med-1', nombre: 'Dra. Rivera' },
        ]),
      },
    };

    const result = await getPatientOperationalHistoryReadModel({
      prisma: prisma as never,
      patientId: 'patient-1',
      effectiveMedicoId: 'med-1',
      limit: 20,
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.any(Array),
        }),
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'audit-restore',
        reason: 'PATIENT_RESTORED',
        label: 'Restauración de paciente',
        detail: 'Se reabrieron 1 atenciones que habían sido canceladas por el archivado.',
        userName: 'Dra. Rivera',
        encounterId: null,
      }),
      expect.objectContaining({
        id: 'audit-reopen',
        reason: 'ENCOUNTER_REOPENED',
        detail: 'La atención volvió a estado en progreso al restaurar la ficha del paciente.',
        encounterId: 'enc-1',
      }),
    ]);
  });
});
