import { BadRequestException } from '@nestjs/common';
import { completeEncounterWorkflowMutation } from './encounters-workflow-complete-sign';
import { REQUIRED_COMPLETION_SECTIONS } from './encounters-sanitize';
import { assertEncounterClinicalOutputAllowed } from '../common/utils/patient-completeness';
import { formatEncounterResponse } from './encounters-presenters';
import { syncEncounterClinicalStructures } from './encounters-clinical-structures';

jest.mock('../common/utils/patient-completeness', () => ({
  assertEncounterClinicalOutputAllowed: jest.fn(),
}));
jest.mock('./encounters-presenters', () => ({
  formatEncounterResponse: jest.fn((encounter) => encounter),
}));
jest.mock('./encounters-clinical-structures', () => ({
  syncEncounterClinicalStructures: jest.fn().mockResolvedValue(undefined),
}));

describe('completeEncounterWorkflowMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildRequiredSections() {
    return REQUIRED_COMPLETION_SECTIONS.map((sectionKey) => ({
      sectionKey,
      completed: true,
      data: { texto: `${sectionKey}-ok` },
    }));
  }

  it('rejects completion when a required section is incomplete', async () => {
    const sections = buildRequiredSections();
    sections[0].completed = false;

    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: (client: any) => Promise<unknown>) => callback(prisma)),
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'EN_PROGRESO',
          medicoId: 'med-1',
          patient: { completenessStatus: 'VERIFICADA' },
          sections,
        }),
        update: jest.fn(),
      },
    };

    const auditService = { log: jest.fn() };

    await expect(
      completeEncounterWorkflowMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        id: 'enc-1',
        userId: 'med-1',
        closureNote: 'Nota de cierre suficientemente descriptiva.',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.encounter.update).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('completes encounter and emits audit log when required sections are valid', async () => {
    const updatedEncounter = {
      id: 'enc-1',
      status: 'COMPLETADO',
      reviewStatus: 'REVISADA_POR_MEDICO',
      sections: buildRequiredSections(),
      patient: { id: 'pat-1' },
      createdBy: { id: 'med-1', nombre: 'Dra. Demo' },
      reviewRequestedBy: null,
      reviewedBy: { id: 'med-1', nombre: 'Dra. Demo' },
      completedBy: { id: 'med-1', nombre: 'Dra. Demo' },
    };

    const prisma = {
      $transaction: jest.fn().mockImplementation(async (callback: (client: any) => Promise<unknown>) => callback(prisma)),
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'EN_PROGRESO',
          medicoId: 'med-1',
          patient: { completenessStatus: 'VERIFICADA' },
          sections: buildRequiredSections(),
        }),
        update: jest.fn().mockResolvedValue(updatedEncounter),
      },
    };

    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const result = await completeEncounterWorkflowMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      id: 'enc-1',
      userId: 'med-1',
      closureNote: 'Nota de cierre suficientemente descriptiva.',
    });

    expect(assertEncounterClinicalOutputAllowed).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enc-1' },
        data: expect.objectContaining({
          status: 'COMPLETADO',
          reviewStatus: 'REVISADA_POR_MEDICO',
          completedById: 'med-1',
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Encounter',
        entityId: 'enc-1',
        action: 'UPDATE',
      }),
      prisma,
    );
    expect(syncEncounterClinicalStructures).toHaveBeenCalledWith({
      prisma,
      encounterId: 'enc-1',
    });
    expect(formatEncounterResponse).toHaveBeenCalledWith(updatedEncounter);
    expect(result).toBe(updatedEncounter);
  });
});
