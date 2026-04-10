import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('rejects uncataloged audit events instead of silently storing AUDIT_UNSPECIFIED', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
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
        findFirst: jest.fn().mockResolvedValue(null),
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

  it('accepts signed encounter updates because they are cataloged explicitly', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const service = new AuditService(prisma as any);

    await expect(
      service.log({
        entityType: 'Encounter',
        entityId: 'encounter-1',
        userId: 'user-1',
        action: 'UPDATE',
        diff: {
          status: 'FIRMADO',
          signatureId: 'signature-1',
        },
      }),
    ).resolves.not.toThrow();

    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  // ── QW-1: PHI redaction regression tests ────────────────────────────
  // These tests guarantee that identifiable patient fields (nombre, rut,
  // domicilio, trabajo) are NEVER stored in plain text inside audit logs.
  // If someone accidentally adds these keys to SAFE_CLINICAL_STRING_KEYS,
  // these tests will fail and prevent the change from being merged.

  const PHI_FIELDS = ['nombre', 'rut', 'domicilio', 'trabajo'];
  const PHI_VALUES: Record<string, string> = {
    nombre: 'Juan Pérez González',
    rut: '12.345.678-5',
    domicilio: 'Av. Providencia 1234, Santiago',
    trabajo: 'Ingeniero Civil',
  };

  function createMockPrisma() {
    return {
      auditLog: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
  }

  function extractStoredDiff(prisma: ReturnType<typeof createMockPrisma>): string {
    const call = prisma.auditLog.create.mock.calls[0]?.[0];
    return call?.data?.diff ?? '';
  }

  describe('PHI redaction in Patient audit logs', () => {
    it.each(PHI_FIELDS)(
      'redacts "%s" from Patient UPDATE diffs (before/after pattern)',
      async (field) => {
        const prisma = createMockPrisma();
        const service = new AuditService(prisma as any);

        const patientBefore = {
          id: 'patient-1',
          patientId: 'patient-1',
          createdById: 'user-1',
          status: 'active',
          [field]: PHI_VALUES[field],
        };

        const patientAfter = {
          ...patientBefore,
          [field]: `${PHI_VALUES[field]} (actualizado)`,
        };

        await service.log({
          entityType: 'Patient',
          entityId: 'patient-1',
          userId: 'user-1',
          action: 'CREATE',
          diff: { before: patientBefore, after: patientAfter },
        });

        const storedDiff = extractStoredDiff(prisma);
        expect(storedDiff).not.toContain(PHI_VALUES[field]);
        expect(storedDiff).toContain('"redacted":true');
      },
    );

    it('redacts all PHI fields simultaneously in a realistic Patient UPDATE diff', async () => {
      const prisma = createMockPrisma();
      const service = new AuditService(prisma as any);

      const fullPatient = {
        id: 'patient-1',
        createdById: 'user-1',
        nombre: 'María López',
        rut: '9.876.543-2',
        domicilio: 'Los Leones 500, Providencia',
        trabajo: 'Profesora',
        edad: 42,
        sexo: 'FEMENINO',
        prevision: 'FONASA',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };

      await service.log({
        entityType: 'Patient',
        entityId: 'patient-1',
        userId: 'user-1',
        action: 'CREATE',
        diff: { created: fullPatient },
      });

      const storedDiff = extractStoredDiff(prisma);
      expect(storedDiff).not.toContain('María López');
      expect(storedDiff).not.toContain('9.876.543-2');
      expect(storedDiff).not.toContain('Los Leones 500');
      expect(storedDiff).not.toContain('Profesora');
      // Safe keys should still be present
      expect(storedDiff).toContain('patient-1');
      expect(storedDiff).toContain('user-1');
    });
  });

  describe('PHI redaction in PatientHistory audit logs', () => {
    it('redacts free-text clinical content in PatientHistory diffs', async () => {
      const prisma = createMockPrisma();
      const service = new AuditService(prisma as any);

      const historyData = {
        id: 'history-1',
        patientId: 'patient-1',
        antecedentesMedicos: JSON.stringify({ texto: 'Hipertensión arterial en tratamiento' }),
        alergias: JSON.stringify({ items: ['Penicilina', 'Polen'] }),
        updatedAt: '2026-03-15T10:00:00.000Z',
      };

      await service.log({
        entityType: 'PatientHistory',
        entityId: 'history-1',
        userId: 'user-1',
        action: 'UPDATE',
        diff: { before: null, after: historyData },
      });

      const storedDiff = extractStoredDiff(prisma);
      expect(storedDiff).not.toContain('Hipertensión arterial');
      expect(storedDiff).not.toContain('Penicilina');
      expect(storedDiff).not.toContain('Polen');
      // IDs and timestamps should still be present
      expect(storedDiff).toContain('history-1');
      expect(storedDiff).toContain('patient-1');
    });
  });
});
