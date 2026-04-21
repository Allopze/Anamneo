import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PatientsExportBundleService } from './patients-export-bundle.service';

describe('PatientsExportBundleService', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const consentsService = {
    findByPatient: jest.fn().mockResolvedValue([
      {
        id: 'consent-1',
        patientId: 'patient-1',
        encounterId: 'enc-1',
        type: 'TRATAMIENTO',
        description: 'Consentimiento informado',
        status: 'ACTIVO',
        grantedAt: '2026-04-21T12:00:00.000Z',
        revokedAt: null,
      },
    ]),
  };

  const patientsPdfService = {
    generateLongitudinalPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 historial clinico')),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a zip bundle containing the clinical PDF, manifest, consents and attachments', async () => {
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-bundle-'));
    const attachmentPath = path.join(uploadsDir, 'hemograma.pdf');
    fs.writeFileSync(attachmentPath, '%PDF-1.4 adjunto');

    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          nombre: 'Paciente Demo',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          edad: 40,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          completenessStatus: 'VERIFICADA',
          registrationMode: 'COMPLETO',
          archivedAt: null,
          createdById: 'med-1',
          createdBy: { medicoId: 'med-1' },
        }),
      },
      encounter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-1' }),
      },
      attachment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'attachment-1',
            originalName: 'hemograma.pdf',
            mime: 'application/pdf',
            size: 18,
            storagePath: 'hemograma.pdf',
            uploadedAt: new Date('2026-04-21T12:00:00.000Z'),
            category: 'EXAMEN',
            description: 'Resultado de laboratorio',
            encounter: {
              id: 'enc-1',
              status: 'EN_PROGRESO',
              createdAt: new Date('2026-04-21T10:00:00.000Z'),
            },
          },
        ]),
      },
    };

    const configService = {
      get: jest.fn().mockReturnValue(uploadsDir),
    };

    try {
      const service = new PatientsExportBundleService(
        prisma as never,
        configService as never,
        auditService as never,
        consentsService as never,
        patientsPdfService as never,
      );

      const result = await service.generateBundle('patient-1', {
        id: 'med-1',
        role: 'MEDICO',
        nombre: 'Dra. Rivera',
        email: 'medico@test.com',
      });

      expect(result.filename).toContain('Paquete clinico');
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.buffer.includes(Buffer.from('historial-clinico.pdf'))).toBe(true);
      expect(result.buffer.includes(Buffer.from('consentimientos.json'))).toBe(true);
      expect(result.buffer.includes(Buffer.from('manifest.json'))).toBe(true);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'Patient',
          action: 'EXPORT',
          diff: expect.objectContaining({
            export: expect.objectContaining({
              type: 'bundle_zip',
              attachmentCount: 1,
              consentCount: 1,
            }),
          }),
        }),
      );
    } finally {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });

  it('skips missing attachment files and still returns a valid archive', async () => {
    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anamneo-bundle-missing-'));
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          nombre: 'Paciente Demo',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          edad: 40,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          completenessStatus: 'VERIFICADA',
          registrationMode: 'COMPLETO',
          archivedAt: null,
          createdById: 'med-1',
          createdBy: { medicoId: 'med-1' },
        }),
      },
      encounter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-1' }),
      },
      attachment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'attachment-missing',
            originalName: 'faltante.pdf',
            mime: 'application/pdf',
            size: 20,
            storagePath: 'faltante.pdf',
            uploadedAt: new Date('2026-04-21T12:00:00.000Z'),
            category: 'EXAMEN',
            description: null,
            encounter: {
              id: 'enc-1',
              status: 'EN_PROGRESO',
              createdAt: new Date('2026-04-21T10:00:00.000Z'),
            },
          },
        ]),
      },
    };
    const configService = {
      get: jest.fn().mockReturnValue(uploadsDir),
    };

    try {
      const service = new PatientsExportBundleService(
        prisma as never,
        configService as never,
        auditService as never,
        consentsService as never,
        patientsPdfService as never,
      );

      const result = await service.generateBundle('patient-1', {
        id: 'med-1',
        role: 'MEDICO',
        nombre: 'Dra. Rivera',
        email: 'medico@test.com',
      });

      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.buffer.includes(Buffer.from('manifest.json'))).toBe(true);
      expect(auditService.log).toHaveBeenLastCalledWith(
        expect.objectContaining({
          diff: expect.objectContaining({
            export: expect.objectContaining({
              warningCount: 1,
            }),
          }),
        }),
      );
    } finally {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
  });
});