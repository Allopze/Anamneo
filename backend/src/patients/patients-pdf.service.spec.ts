import { BadRequestException } from '@nestjs/common';
import { PatientsPdfService } from './patients-pdf.service';
import { formatHistoryFieldText } from './patients-pdf-helpers';

function countPdfPages(buffer: Buffer) {
  return buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

describe('PatientsPdfService', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const settingsService = {
    getAll: jest.fn().mockResolvedValue({
      'clinic.name': 'Clínica Anamneo',
      'clinic.identifier': '76.123.456-7',
      'clinic.address': 'Av. Salud 123',
      'clinic.phone': '+56 2 2222 2222',
      'clinic.email': 'contacto@anamneo.cl',
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    settingsService.getAll.mockClear();
  });

  it('filters longitudinal encounters by medico scope for non-admin users', async () => {
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          nombre: 'Paciente Demo',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          fechaNacimiento: new Date('1986-03-18T00:00:00.000Z'),
          edad: 40,
          edadMeses: null,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          completenessStatus: 'VERIFICADA',
          trabajo: null,
          domicilio: null,
          centroMedico: null,
          createdById: 'owner-medico',
          archivedAt: null,
          history: {},
          problems: [],
        }),
      },
      encounter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-allowed' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new PatientsPdfService(prisma as any, auditService as any, settingsService as any);

    const pdfBuffer = await service.generateLongitudinalPdf('patient-1', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    });

    expect(countPdfPages(pdfBuffer)).toBe(1);
    expect(settingsService.getAll).toHaveBeenCalled();
    expect(prisma.encounter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: 'patient-1',
          medicoId: 'med-1',
        }),
      }),
    );
  });

  it('formats stored JSON history values into readable clinical text', () => {
    expect(formatHistoryFieldText('{"items":["HTA"],"texto":"En control"}')).toBe('HTA. En control');
    expect(formatHistoryFieldText('Texto libre')).toBe('Texto libre');
    expect(formatHistoryFieldText(null)).toBe('');
  });

  it('builds a readable longitudinal PDF filename from the patient name', async () => {
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          nombre: 'José Pérez / Control',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          fechaNacimiento: new Date('1986-03-18T00:00:00.000Z'),
          edad: 40,
          edadMeses: null,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          completenessStatus: 'VERIFICADA',
          archivedAt: null,
          createdById: 'owner-medico',
          createdBy: { medicoId: 'med-1' },
        }),
      },
    };

    const service = new PatientsPdfService(prisma as any, auditService as any, settingsService as any);

    await expect(
      service.getLongitudinalPdfFilename('patient-1', {
        id: 'med-1',
        role: 'MEDICO',
        nombre: 'Dra. Rivera',
      }),
    ).resolves.toMatch(/^Jose Perez Control - Historial clinico - \d{2}-\d{2}-\d{4}\.pdf$/);
  });

  it('does not log parse warnings for plain-text history values', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const baselineCalls = warnSpy.mock.calls.length;
      expect(formatHistoryFieldText('Texto libre de control clínico')).toBe('Texto libre de control clínico');
      const newCalls = warnSpy.mock.calls.slice(baselineCalls);
      expect(newCalls).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('blocks longitudinal export when the patient record is not enabled for official clinical output', async () => {
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          nombre: 'Paciente Demo',
          rut: null,
          rutExempt: false,
          rutExemptReason: null,
          edad: null,
          edadMeses: null,
          sexo: null,
          prevision: null,
          completenessStatus: 'INCOMPLETA',
          trabajo: null,
          domicilio: null,
          centroMedico: null,
          archivedAt: null,
          history: {},
          problems: [],
          createdById: 'owner-medico',
        }),
      },
      encounter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-allowed' }),
        findMany: jest.fn(),
      },
    };

    const service = new PatientsPdfService(prisma as any, auditService as any, settingsService as any);

    await expect(
      service.generateLongitudinalPdf('patient-1', {
        id: 'med-1',
        role: 'MEDICO',
        nombre: 'Dra. Rivera',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not add extra footer-only pages to long longitudinal exports', async () => {
    const longText = Array.from({ length: 120 }, () => 'Control clinico longitudinal con antecedentes relevantes.').join(' ');
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          nombre: 'Paciente Demo',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          fechaNacimiento: new Date('1986-03-18T00:00:00.000Z'),
          edad: 40,
          edadMeses: null,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          completenessStatus: 'VERIFICADA',
          trabajo: null,
          domicilio: null,
          centroMedico: null,
          createdById: 'owner-medico',
          archivedAt: null,
          history: {
            antecedentesMedicos: longText,
          },
          problems: [],
        }),
      },
      encounter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-allowed' }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'enc-1',
            status: 'COMPLETADO',
            createdAt: new Date('2026-04-08T12:00:00.000Z'),
            sections: [
              {
                sectionKey: 'MOTIVO_CONSULTA',
                schemaVersion: 1,
                data: JSON.stringify({ texto: longText }),
              },
            ],
            createdBy: { nombre: 'Dra. Rivera' },
          },
        ]),
      },
    };

    const service = new PatientsPdfService(prisma as any, auditService as any, settingsService as any);
    const pdfBuffer = await service.generateLongitudinalPdf('patient-1', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    });

    const pageCount = countPdfPages(pdfBuffer);
    expect(pageCount).toBeGreaterThan(1);
    expect(pageCount).toBeLessThan(6);
  });
});
