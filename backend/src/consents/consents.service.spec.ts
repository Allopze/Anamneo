import { ConsentsService } from './consents.service';

jest.mock('../common/utils/patient-access', () => ({
  assertPatientAccess: jest.fn().mockResolvedValue(undefined),
}));

describe('ConsentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates consent and audit log inside the same transaction flow', async () => {
    const tx = {
      informedConsent: {
        create: jest.fn().mockResolvedValue({
          id: 'consent-1',
          patientId: 'pat-1',
          encounterId: 'enc-1',
          type: 'TRATAMIENTO',
          description: 'Consentimiento',
          grantedAt: new Date('2026-04-16T10:00:00.000Z'),
          grantedById: 'med-1',
          revokedAt: null,
          revokedById: null,
          revokedReason: null,
          createdAt: new Date('2026-04-16T10:00:00.000Z'),
          updatedAt: new Date('2026-04-16T10:00:00.000Z'),
        }),
      },
    };
    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({ patientId: 'pat-1', medicoId: 'med-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'med-1', nombre: 'Dra. Demo' }]) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ConsentsService(prisma as never, audit as never);

    const result = await service.create(
      {
        patientId: 'pat-1',
        encounterId: 'enc-1',
        type: 'TRATAMIENTO',
        description: 'Consentimiento',
      },
      { id: 'med-1', role: 'MEDICO' } as never,
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.informedConsent.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'InformedConsent',
        entityId: 'consent-1',
        reason: 'CONSENT_GRANTED',
      }),
      tx,
    );
    expect(result.id).toBe('consent-1');
  });

  it('revokes consent and audit log inside the same transaction flow', async () => {
    const tx = {
      informedConsent: {
        update: jest.fn().mockResolvedValue({
          id: 'consent-1',
          patientId: 'pat-1',
          encounterId: 'enc-1',
          type: 'TRATAMIENTO',
          description: 'Consentimiento',
          grantedAt: new Date('2026-04-16T10:00:00.000Z'),
          grantedById: 'med-1',
          revokedAt: new Date('2026-04-16T10:10:00.000Z'),
          revokedById: 'med-1',
          revokedReason: 'Paciente retira consentimiento',
          createdAt: new Date('2026-04-16T10:00:00.000Z'),
          updatedAt: new Date('2026-04-16T10:10:00.000Z'),
        }),
      },
    };
    const prisma = {
      informedConsent: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'consent-1',
          patientId: 'pat-1',
          encounterId: 'enc-1',
          revokedAt: null,
          encounter: { medicoId: 'med-1' },
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ConsentsService(prisma as never, audit as never);

    const result = await service.revoke(
      'consent-1',
      { reason: 'Paciente retira consentimiento' },
      { id: 'med-1', role: 'MEDICO' } as never,
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.informedConsent.update).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'InformedConsent',
        entityId: 'consent-1',
        reason: 'CONSENT_REVOKED',
      }),
      tx,
    );
    expect(result.status).toBe('REVOCADO');
  });
});