import { PatientsService } from './patients.service';
import {
  findAllPatients,
  findPossiblePatientDuplicates,
  findEncounterTimeline,
  findOperationalHistory,
  findTasks,
  getPatientAdminSummary,
} from './patients-service-read.helpers';
import { assertPatientAccessScope } from './patients-access';

jest.mock('./patients-service-read.helpers', () => ({
  findAllPatients: jest.fn(),
  findPossiblePatientDuplicates: jest.fn(),
  exportPatientsCsv: jest.fn(),
  getPatientAdminSummary: jest.fn(),
  findPatientById: jest.fn(),
  findEncounterTimeline: jest.fn(),
  findOperationalHistory: jest.fn(),
  getClinicalSummary: jest.fn(),
  findTasks: jest.fn(),
}));

jest.mock('./patients-access', () => ({
  assertPatientAccessScope: jest.fn().mockResolvedValue(undefined),
}));

describe('PatientsService read auditing', () => {
  const prisma = {} as never;
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const settingsService = {
    getEncounterSectionConfig: jest.fn().mockResolvedValue(undefined),
  };
  const user = { id: 'med-1', role: 'MEDICO', isAdmin: false } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('audits patient list reads with aggregate metadata', async () => {
    (findAllPatients as jest.Mock).mockResolvedValue({
      data: [{ id: 'patient-1' }],
      pagination: { total: 7 },
    });

    const service = new PatientsService(prisma as never, auditService as never, { assertConsentFor: async () => undefined } as never, settingsService as never);
    const result = await service.findAll(user, 'dolor', 2, 20, { sexo: 'FEMENINO' } as never);

    expect(result.pagination.total).toBe(7);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientList',
        entityId: 'med-1',
        action: 'READ',
        reason: 'PATIENT_LIST_VIEWED',
        diff: expect.objectContaining({
          scope: 'PATIENT_LIST',
          hasSearch: true,
          page: 2,
          limit: 20,
          total: 7,
          returned: 1,
        }),
      }),
    );
  });

  it('audits duplicate searches without storing query text', async () => {
    (findPossiblePatientDuplicates as jest.Mock).mockResolvedValue([
      { id: 'patient-2', matchReasons: ['same_rut'] },
    ]);

    const service = new PatientsService(prisma as never, auditService as never, { assertConsentFor: async () => undefined } as never, settingsService as never);
    const duplicates = await service.findPossibleDuplicates(user, {
      rut: '11.111.111-1',
      nombre: 'Paciente Demo',
      fechaNacimiento: '1990-05-10',
    });

    expect(duplicates).toHaveLength(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientDuplicatesSearch',
        reason: 'PATIENT_DUPLICATES_SEARCHED',
        diff: expect.objectContaining({
          scope: 'PATIENT_DUPLICATES_SEARCH',
          criteria: expect.objectContaining({
            rut: true,
            nombre: true,
            fechaNacimiento: true,
            excludePatientId: false,
          }),
          matchCount: 1,
        }),
      }),
    );
  });

  it('audits patient admin summaries with aggregate metrics only', async () => {
    (getPatientAdminSummary as jest.Mock).mockResolvedValue({
      id: 'patient-1',
      completenessStatus: 'VERIFICADA',
      metrics: {
        encounterCount: 4,
        lastEncounterAt: new Date('2026-04-22T10:00:00.000Z'),
      },
    });

    const service = new PatientsService(prisma as never, auditService as never, { assertConsentFor: async () => undefined } as never, settingsService as never);
    await service.getAdminSummary(user, 'patient-1');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientAdminSummary',
        entityId: 'patient-1',
        reason: 'PATIENT_ADMIN_SUMMARY_VIEWED',
        diff: expect.objectContaining({
          scope: 'PATIENT_ADMIN_SUMMARY',
          encounterCount: 4,
          hasRecentEncounter: true,
          completenessStatus: 'VERIFICADA',
        }),
      }),
    );
  });

  it('audits timeline, history, and task inbox reads', async () => {
    (findEncounterTimeline as jest.Mock).mockResolvedValue({
      data: [{ id: 'enc-1' }],
      pagination: { total: 3 },
    });
    (findOperationalHistory as jest.Mock).mockResolvedValue([
      { id: 'event-1' },
      { id: 'event-2' },
    ]);
    (findTasks as jest.Mock).mockResolvedValue({
      data: [{ id: 'task-1' }],
      pagination: { page: 1, limit: 20, total: 5, totalPages: 1 },
    });

    const service = new PatientsService(prisma as never, auditService as never, { assertConsentFor: async () => undefined } as never, settingsService as never);

    await service.findEncounterTimeline(user, 'patient-1', 3, 5);
    await service.findOperationalHistory(user, 'patient-1', 20);
    await service.findTasks(user, { search: 'seguimiento', overdueOnly: true });

    expect(assertPatientAccessScope).toHaveBeenCalledTimes(2);
    expect(findEncounterTimeline).toHaveBeenCalledWith(prisma, user, 'patient-1', 3, 5, undefined);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientTimeline',
        reason: 'PATIENT_TIMELINE_VIEWED',
        diff: expect.objectContaining({
          scope: 'PATIENT_TIMELINE',
          page: 3,
          limit: 5,
          total: 3,
          returned: 1,
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientOperationalHistory',
        reason: 'PATIENT_OPERATIONAL_HISTORY_VIEWED',
        diff: expect.objectContaining({
          scope: 'PATIENT_OPERATIONAL_HISTORY',
          limit: 20,
          itemCount: 2,
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'PatientTaskInbox',
        reason: 'PATIENT_TASKS_VIEWED',
        diff: expect.objectContaining({
          scope: 'PATIENT_TASK_INBOX',
          total: 5,
          filters: expect.objectContaining({
            hasSearch: true,
            overdueOnly: true,
          }),
        }),
      }),
    );
  });
});
