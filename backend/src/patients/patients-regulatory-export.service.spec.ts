import { NotFoundException } from '@nestjs/common';
import { PatientsRegulatoryExportService } from './patients-regulatory-export.service';

jest.mock('../common/utils/field-crypto', () => ({
  decryptField: (value: string) => {
    if (value.startsWith('enc:v1:')) {
      return value.slice('enc:v1:'.length);
    }
    return value;
  },
}));

function buildPrismaMock(overrides: Record<string, unknown> = {}) {
  return {
    patient: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'p1', nombre: 'Paciente Demo', rut: '12.345.678-9', archivedAt: null,
      }),
    },
    patientHistory: { findUnique: jest.fn().mockResolvedValue({ patientId: 'p1', alergias: null }) },
    encounter: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'e1',
          patientId: 'p1',
          status: 'FIRMADO',
          createdAt: new Date('2026-01-01'),
          sections: [
            { id: 's1', sectionKey: 'IDENTIFICACION', schemaVersion: 1, completed: true, notApplicable: false, notApplicableReason: null, updatedAt: new Date(), data: '{"nombre":"X"}' },
            { id: 's2', sectionKey: 'TRATAMIENTO', schemaVersion: 1, completed: true, notApplicable: false, notApplicableReason: null, updatedAt: new Date(), data: 'enc:v1:{"plan":"Y"}' },
          ],
          signatures: [],
          diagnoses: [],
          treatments: [],
        },
      ]),
    },
    attachment: { findMany: jest.fn().mockResolvedValue([]) },
    informedConsent: { findMany: jest.fn().mockResolvedValue([]) },
    clinicalAlert: { findMany: jest.fn().mockResolvedValue([]) },
    patientProblem: { findMany: jest.fn().mockResolvedValue([]) },
    encounterTask: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as any;
}

const config = { get: jest.fn().mockReturnValue('/tmp') } as any;
const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;
const user = { id: 'admin', role: 'ADMIN', isAdmin: true, email: 'a@x.cl', nombre: 'Admin' } as any;

describe('PatientsRegulatoryExportService', () => {
  it('throws NotFound if patient missing', async () => {
    const prisma = buildPrismaMock();
    prisma.patient.findUnique.mockResolvedValue(null);
    const service = new PatientsRegulatoryExportService(prisma, config, audit);

    await expect(service.buildRegulatoryBundle('p1', user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('builds a regulatory JSON with all sections decrypted', async () => {
    const prisma = buildPrismaMock();
    const service = new PatientsRegulatoryExportService(prisma, config, audit);

    const { json } = await service.buildRegulatoryBundle('p1', user);
    expect(json.patient).toMatchObject({ id: 'p1' });
    expect(Array.isArray(json.encounters)).toBe(true);
    const encounter = (json.encounters as any[])[0];
    expect(encounter.sections[0].data).toEqual({ nombre: 'X' });
    expect(encounter.sections[1].data).toEqual({ plan: 'Y' });
    expect(json.regulatoryContext).toBeDefined();
    expect(json.generatedBy).toMatchObject({ role: 'ADMIN' });
  });

  it('emits audit log on zip export', async () => {
    const prisma = buildPrismaMock();
    const service = new PatientsRegulatoryExportService(prisma, config, audit);

    const { buffer, filename } = await service.buildZip('p1', user);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(filename).toMatch(/paciente-p1-regulatorio-/);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'EXPORT',
      reason: 'PATIENT_DATA_EXPORTED_REGULATORY',
    }));
  });
});
