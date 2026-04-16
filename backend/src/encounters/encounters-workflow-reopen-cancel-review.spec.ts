import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  cancelEncounterWorkflowMutation,
  reopenEncounterWorkflowMutation,
  updateEncounterReviewStatusMutation,
} from './encounters-workflow-reopen-cancel-review';
import { formatEncounterResponse } from './encounters-presenters';

jest.mock('./encounters-presenters', () => ({
  formatEncounterResponse: jest.fn((encounter) => encounter),
}));

describe('encounters-workflow-reopen-cancel-review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects reopen when encounter is not completed', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'EN_PROGRESO',
          medicoId: 'med-1',
        }),
        update: jest.fn(),
      },
    };

    await expect(
      reopenEncounterWorkflowMutation({
        prisma: prisma as never,
        auditService: { log: jest.fn() } as never,
        id: 'enc-1',
        userId: 'med-1',
        note: 'Motivo de reapertura suficiente para auditoría.',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.encounter.update).not.toHaveBeenCalled();
  });

  it('cancels in-progress encounter and writes audit log', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'EN_PROGRESO',
          medicoId: 'med-1',
          patient: { id: 'pat-1' },
        }),
        update: jest.fn().mockResolvedValue({ id: 'enc-1', status: 'CANCELADO' }),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const result = await cancelEncounterWorkflowMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      id: 'enc-1',
      userId: 'med-1',
    });

    expect(prisma.encounter.update).toHaveBeenCalledWith({
      where: { id: 'enc-1' },
      data: { status: 'CANCELADO' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Encounter',
        entityId: 'enc-1',
        action: 'UPDATE',
      }),
    );
    expect(result).toEqual({ id: 'enc-1', status: 'CANCELADO' });
  });

  it('rejects assistant trying to mark review as reviewed by medico', async () => {
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'COMPLETADO',
          medicoId: 'med-1',
          patient: { id: 'pat-1' },
        }),
        update: jest.fn(),
      },
    };

    await expect(
      updateEncounterReviewStatusMutation({
        prisma: prisma as never,
        auditService: { log: jest.fn() } as never,
        id: 'enc-1',
        user: {
          id: 'assistant-1',
          role: 'ASISTENTE',
          isAdmin: false,
          medicoId: 'med-1',
        },
        reviewStatus: 'REVISADA_POR_MEDICO',
        note: 'Revisión',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.encounter.update).not.toHaveBeenCalled();
  });

  it('marks encounter as ready for review when assistant requests it', async () => {
    const updatedEncounter = {
      id: 'enc-1',
      reviewStatus: 'LISTA_PARA_REVISION',
      sections: [],
      patient: { id: 'pat-1' },
      createdBy: { id: 'assistant-1', nombre: 'Asistente' },
      reviewRequestedBy: { id: 'assistant-1', nombre: 'Asistente' },
      reviewedBy: null,
      completedBy: null,
      tasks: [],
    };

    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'COMPLETADO',
          medicoId: 'med-1',
          patient: { id: 'pat-1' },
        }),
        update: jest.fn().mockResolvedValue(updatedEncounter),
      },
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const result = await updateEncounterReviewStatusMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      id: 'enc-1',
      user: {
        id: 'assistant-1',
        role: 'ASISTENTE',
        isAdmin: false,
        medicoId: 'med-1',
      },
      reviewStatus: 'LISTA_PARA_REVISION',
      note: '  Revisar por médico tratante  ',
    });

    expect(prisma.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enc-1' },
        data: expect.objectContaining({
          reviewStatus: 'LISTA_PARA_REVISION',
          reviewRequestedById: 'assistant-1',
          reviewedById: null,
        }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Encounter',
        action: 'UPDATE',
        diff: expect.objectContaining({ reviewStatus: 'LISTA_PARA_REVISION' }),
      }),
    );
    expect(formatEncounterResponse).toHaveBeenCalledWith(updatedEncounter);
    expect(result).toBe(updatedEncounter);
  });
});
