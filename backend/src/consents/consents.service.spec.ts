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

  it('allows revoking a patient-level consent created by an assistant assigned to the same medico', async () => {
    const tx = {
      informedConsent: {
        update: jest.fn().mockResolvedValue({
          id: 'consent-1',
          patientId: 'pat-1',
          encounterId: null,
          type: 'TRATAMIENTO',
          description: 'Consentimiento administrativo',
          grantedAt: new Date('2026-04-16T10:00:00.000Z'),
          grantedById: 'assistant-1',
          revokedAt: new Date('2026-04-16T10:10:00.000Z'),
          revokedById: 'med-1',
          revokedReason: 'Revisión médica',
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
          encounterId: null,
          revokedAt: null,
          grantedById: 'assistant-1',
          grantedBy: { medicoId: 'med-1' },
          encounter: null,
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ConsentsService(prisma as never, audit as never);

    const result = await service.revoke(
      'consent-1',
      { reason: 'Revisión médica' },
      { id: 'med-1', role: 'MEDICO' } as never,
    );

    expect(tx.informedConsent.update).toHaveBeenCalled();
    expect(result.status).toBe('REVOCADO');
  });

  it('returns withMeta and revokedHasMore without leaking the extra fetched row', async () => {
    const baseConsent = {
      id: 'consent-active',
      patientId: 'pat-1',
      encounterId: null,
      type: 'TRATAMIENTO',
      description: 'Consentimiento',
      grantedAt: new Date('2026-04-16T08:00:00.000Z'),
      grantedById: 'med-1',
      revokedAt: null,
      revokedById: null,
      revokedReason: null,
      createdAt: new Date('2026-04-16T08:00:00.000Z'),
      updatedAt: new Date('2026-04-16T08:00:00.000Z'),
    };
    const revokedConsents = [
      {
        ...baseConsent,
        id: 'consent-revoked-1',
        revokedAt: new Date('2026-04-16T09:00:00.000Z'),
        revokedById: 'med-1',
        revokedReason: 'Paciente retira consentimiento',
      },
      {
        ...baseConsent,
        id: 'consent-revoked-2',
        revokedAt: new Date('2026-04-16T08:30:00.000Z'),
        revokedById: 'med-1',
        revokedReason: 'Cambio de plan',
      },
    ];
    const prisma = {
      informedConsent: {
        findMany: jest.fn()
          .mockResolvedValueOnce([baseConsent])
          .mockResolvedValueOnce(revokedConsents),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'med-1', nombre: 'Dra. Demo' }]) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ConsentsService(prisma as never, audit as never);

    const result = await service.findByPatient(
      'pat-1',
      { id: 'med-1', role: 'MEDICO' } as never,
      { revokedLimit: 1, withMeta: true },
    );

    expect(result.meta.revokedHasMore).toBe(true);
    expect(result.data.map((consent) => consent.id)).toEqual(['consent-active', 'consent-revoked-1']);
    expect(prisma.informedConsent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 2 }),
    );
  });
});
