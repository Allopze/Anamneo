import { BadRequestException } from '@nestjs/common';
import { AdminMaintenanceService } from './admin-maintenance.service';

describe('AdminMaintenanceService', () => {
  const user = { id: 'admin-user-id', email: 'admin@example.com', nombre: 'Admin', role: 'ADMIN', isAdmin: true };
  const prisma = {
    passwordResetToken: {
      deleteMany: jest.fn(),
    },
    encounter: {
      findMany: jest.fn(),
    },
    patientClinicalSearch: {
      deleteMany: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  };
  const auditService = {
    log: jest.fn(),
  };
  const attachmentsService = {
    purgeExpiredAttachments: jest.fn(),
  };
  const configService = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  };
  const authPasswordResetService = {
    purgeExpiredTokens: jest.fn(),
  };

  let service: AdminMaintenanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminMaintenanceService(
      prisma as never,
      auditService as never,
      attachmentsService as never,
      configService as never,
      authPasswordResetService as never,
    );
  });

  it('requires exact textual confirmation and audits rejected attempts', async () => {
    await expect(
      service.purgeExpiredPasswordResetTokens(user, {
        confirmation: 'PURGAR',
        reason: 'operacion solicitada por soporte',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'AdminMaintenance',
        entityId: 'purgeExpiredPasswordResetTokens',
        result: 'REJECTED',
      }),
    );
  });

  it('purges expired password reset tokens and writes an audit summary', async () => {
    authPasswordResetService.purgeExpiredTokens.mockResolvedValue(3);

    const result = await service.purgeExpiredPasswordResetTokens(user, {
      confirmation: 'PURGAR TOKENS RESET EXPIRADOS',
      reason: 'limpieza operativa semanal',
    });

    expect(result).toEqual({
      action: 'purgeExpiredPasswordResetTokens',
      deleted: 3,
      retentionDays: 7,
      cutoff: expect.any(String),
    });
    expect(authPasswordResetService.purgeExpiredTokens).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'AdminMaintenance',
        entityId: 'purgeExpiredPasswordResetTokens',
      }),
    );
  });

  it('audits legacy plaintext columns with a summarized result', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { table_name: 'patients', column_name: 'rut' },
    ]);

    const result = await service.auditLegacyPlaintext(user, {
      confirmation: 'AUDITAR PLAINTEXT LEGACY',
      reason: 'revision pre despliegue',
    });

    expect(result).toEqual({
      action: 'auditLegacyPlaintext',
      legacyPlaintextColumnsPresent: ['patients.rut'],
      status: 'REVIEW_REQUIRED',
    });
  });
});
