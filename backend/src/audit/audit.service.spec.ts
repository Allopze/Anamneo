import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('rejects uncataloged audit events instead of silently storing AUDIT_UNSPECIFIED', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn(),
      },
    };

    const service = new AuditService(prisma as any);

    await expect(
      service.log({
        entityType: 'UnknownEntity',
        entityId: 'entity-1',
        userId: 'user-1',
        action: 'UPDATE',
        diff: {},
      }),
    ).rejects.toThrow('must define an explicit catalog reason');

    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('redacts clinical payloads before storing encounter section updates', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn(),
      },
    };

    const service = new AuditService(prisma as any);

    await service.log({
      entityType: 'EncounterSection',
      entityId: 'section-1',
      userId: 'user-1',
      action: 'UPDATE',
      diff: {
        sectionKey: 'MOTIVO_CONSULTA',
        data: JSON.stringify({ subjetivo: 'dolor torácico' }),
        completed: true,
      },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diff: expect.stringContaining('"data":{"redacted":true'),
        }),
      }),
    );
  });
});
