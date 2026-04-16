import { BadRequestException } from '@nestjs/common';
import { PatientsPdfService } from './patients-pdf.service';
import { formatHistoryFieldText } from './patients-pdf-helpers';

describe('PatientsPdfService', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
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

    const service = new PatientsPdfService(prisma as any, auditService as any);

    await service.generateLongitudinalPdf('patient-1', {
      id: 'med-1',
      role: 'MEDICO',
      nombre: 'Dra. Rivera',
    });

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

    const service = new PatientsPdfService(prisma as any, auditService as any);

    await expect(
      service.generateLongitudinalPdf('patient-1', {
        id: 'med-1',
        role: 'MEDICO',
        nombre: 'Dra. Rivera',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
