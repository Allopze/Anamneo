import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  completeEncounterWorkflowMutation,
  signEncounterWorkflowMutation,
} from './encounters-workflow-complete-sign';
import { REQUIRED_COMPLETION_SECTIONS } from './encounters-sanitize';
import { assertEncounterClinicalOutputAllowed } from '../common/utils/patient-completeness';
import { formatEncounterResponse } from './encounters-presenters';
import { syncEncounterClinicalStructures } from './encounters-clinical-structures';

jest.mock('bcrypt');
jest.mock('../common/utils/patient-completeness', () => ({
  assertEncounterClinicalOutputAllowed: jest.fn(),
}));
jest.mock('./encounters-presenters', () => ({
  formatEncounterResponse: jest.fn((encounter) => encounter),
}));

jest.mock('./encounters-clinical-structures', () => ({
  syncEncounterClinicalStructures: jest.fn().mockResolvedValue(undefined),
}));

describe('encounters-workflow-complete-sign', () => {
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

  it('rejects signing when password validation fails', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'med-1',
          active: true,
          passwordHash: 'hash',
        }),
      },
      encounter: {
        findUnique: jest.fn(),
      },
      encounterSignature: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      signEncounterWorkflowMutation({
        prisma: prisma as never,
        auditService: { log: jest.fn() } as never,
        id: 'enc-1',
        userId: 'med-1',
        password: 'incorrecta',
        context: {},
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.encounter.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('signs completed encounter and logs signature metadata', async () => {
    const signature = {
      id: 'sig-1',
      signedAt: new Date('2026-04-16T06:00:00.000Z'),
    };

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'med-1',
          active: true,
          passwordHash: 'hash',
        }),
      },
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'COMPLETADO',
          medicoId: 'med-1',
          sections: [
            { sectionKey: 'TRATAMIENTO', data: { plan: 'Plan A' } },
            { sectionKey: 'MOTIVO_CONSULTA', data: { texto: 'Control' } },
          ],
          attachments: [
            {
              id: 'att-1',
              originalName: 'hemograma.pdf',
              mime: 'application/pdf',
              size: 2048,
              uploadedAt: new Date('2026-04-16T05:55:00.000Z'),
              uploadedById: 'med-1',
              category: 'EXAMEN',
              description: 'Resultado basal',
              linkedOrderType: 'EXAMEN',
              linkedOrderId: 'exam-1',
              linkedOrderLabel: 'Hemograma completo',
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({ id: 'enc-1', status: 'FIRMADO' }),
      },
      encounterSignature: {
        create: jest.fn().mockResolvedValue(signature),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (client: any) => Promise<unknown>) => callback(prisma)),
    };

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const result = await signEncounterWorkflowMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      id: 'enc-1',
      userId: 'med-1',
      password: 'Password1',
      context: { ipAddress: '127.0.0.1', userAgent: 'jest' },
    });

    expect(prisma.encounterSignature.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encounterId: 'enc-1',
          userId: 'med-1',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        }),
      }),
    );
    expect(prisma.encounter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'enc-1' },
        data: { status: 'FIRMADO' },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        diff: expect.objectContaining({
          status: 'FIRMADO',
          signatureId: 'sig-1',
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
      prisma,
    );
    expect(result).toEqual(
      expect.objectContaining({
        signatureId: 'sig-1',
        signedAt: signature.signedAt,
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it('changes the signature hash when attachment metadata changes', async () => {
    const buildPrisma = (attachmentDescription: string) => ({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'med-1',
          active: true,
          passwordHash: 'hash',
        }),
      },
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'enc-1',
          status: 'COMPLETADO',
          medicoId: 'med-1',
          sections: [
            { sectionKey: 'TRATAMIENTO', data: { plan: 'Plan A' } },
            { sectionKey: 'MOTIVO_CONSULTA', data: { texto: 'Control' } },
          ],
          attachments: [
            {
              id: 'att-1',
              originalName: 'hemograma.pdf',
              mime: 'application/pdf',
              size: 2048,
              uploadedAt: new Date('2026-04-16T05:55:00.000Z'),
              uploadedById: 'med-1',
              category: 'EXAMEN',
              description: attachmentDescription,
              linkedOrderType: 'EXAMEN',
              linkedOrderId: 'exam-1',
              linkedOrderLabel: 'Hemograma completo',
            },
          ],
        }),
        update: jest.fn().mockResolvedValue({ id: 'enc-1', status: 'FIRMADO' }),
      },
      encounterSignature: {
        create: jest.fn().mockResolvedValue({ id: 'sig-1', signedAt: new Date('2026-04-16T06:00:00.000Z') }),
      },
      $transaction: jest.fn(),
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const prismaA: any = buildPrisma('Resultado basal');
    prismaA.$transaction = jest.fn().mockImplementation(async (callback: (client: any) => Promise<unknown>) => callback(prismaA));
    const resultA = await signEncounterWorkflowMutation({
      prisma: prismaA,
      auditService: { log: jest.fn().mockResolvedValue(undefined) } as never,
      id: 'enc-1',
      userId: 'med-1',
      password: 'Password1',
      context: {},
    });

    const prismaB: any = buildPrisma('Resultado corregido');
    prismaB.$transaction = jest.fn().mockImplementation(async (callback: (client: any) => Promise<unknown>) => callback(prismaB));
    const resultB = await signEncounterWorkflowMutation({
      prisma: prismaB,
      auditService: { log: jest.fn().mockResolvedValue(undefined) } as never,
      id: 'enc-1',
      userId: 'med-1',
      password: 'Password1',
      context: {},
    });

    expect(resultA.contentHash).not.toBe(resultB.contentHash);
  });
});
