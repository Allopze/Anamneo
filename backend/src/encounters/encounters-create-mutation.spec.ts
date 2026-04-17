import { BadRequestException } from '@nestjs/common';
import { createEncounterMutation } from './encounters-create-mutation';
import { formatEncounterResponse } from './encounters-presenters';
import { parseSectionData } from './encounters-sanitize';

jest.mock('./encounters-presenters', () => ({
  formatEncounterResponse: jest.fn((encounter) => encounter),
}));

describe('encounters-create-mutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const basePatient = {
    id: 'pat-1',
    createdById: 'med-1',
    archivedAt: null,
    history: null,
    nombre: 'Paciente Demo',
    edad: 44,
    edadMeses: null,
    sexo: 'FEMENINO',
    trabajo: null,
    prevision: 'FONASA',
    domicilio: null,
    rut: '11.111.111-1',
    rutExempt: false,
    rutExemptReason: null,
    createdBy: { medicoId: 'med-1' },
  };

  const baseUser = {
    id: 'med-1',
    role: 'MEDICO',
    isAdmin: false,
  };

  it('creates a clean draft when using a closed encounter as base', async () => {
    const createdEncounter = {
      id: 'enc-new',
      status: 'EN_PROGRESO',
      sections: [],
      patient: { id: 'pat-1' },
      createdBy: { id: 'med-1', nombre: 'Medico' },
    };
    const tx = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(basePatient),
      },
      encounter: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-base', status: 'COMPLETADO' }),
        create: jest.fn().mockResolvedValue(createdEncounter),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const result = await createEncounterMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      patientId: 'pat-1',
      createDto: { duplicateFromEncounterId: 'enc-base' },
      user: baseUser as never,
    });

    const sections = tx.encounter.create.mock.calls[0][0].data.sections.create;
    const identification = sections.find((section: any) => section.sectionKey === 'IDENTIFICACION');
    const copiedClinicalSections = sections.filter((section: any) => section.sectionKey !== 'IDENTIFICACION');

    expect(identification).toEqual(
      expect.objectContaining({
        completed: true,
        notApplicable: false,
        notApplicableReason: null,
      }),
    );
    expect(copiedClinicalSections).toEqual(
      expect.arrayContaining(
        copiedClinicalSections.map((section: any) =>
          expect.objectContaining({
            completed: false,
            notApplicable: false,
            notApplicableReason: null,
          }),
        ),
      ),
    );
    expect(copiedClinicalSections.every((section: any) => JSON.stringify(parseSectionData(section.data)) === '{}')).toBe(true);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Encounter',
        entityId: 'enc-new',
        action: 'CREATE',
        diff: expect.objectContaining({
          patientId: 'pat-1',
          duplicatedFromEncounterId: 'enc-base',
        }),
      }),
      tx,
    );
    expect(formatEncounterResponse).toHaveBeenCalledWith(createdEncounter, { viewerRole: 'MEDICO' });
    expect(result).toEqual({
      ...createdEncounter,
      reused: false,
    });
  });

  it('rejects cancelled encounters as duplicate sources', async () => {
    const tx = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(basePatient),
      },
      encounter: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-cancelled', status: 'CANCELADO' }),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    await expect(
      createEncounterMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        patientId: 'pat-1',
        createDto: { duplicateFromEncounterId: 'enc-cancelled' },
        user: baseUser as never,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(tx.encounter.create).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});