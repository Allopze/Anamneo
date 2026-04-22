import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { signEncounterWorkflowMutation } from './encounters-workflow-complete-sign';

jest.mock('bcrypt');

describe('signEncounterWorkflowMutation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
