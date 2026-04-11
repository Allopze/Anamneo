import { PatientsPdfService } from './patients-pdf.service';

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
          rut: null,
          edad: null,
          edadMeses: null,
          sexo: null,
          prevision: null,
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
    const service = new PatientsPdfService({} as any, auditService as any);

    expect((service as any).formatHistoryFieldText('{"items":["HTA"],"texto":"En control"}')).toBe('HTA. En control');
    expect((service as any).formatHistoryFieldText('Texto libre')).toBe('Texto libre');
    expect((service as any).formatHistoryFieldText(null)).toBe('');
  });
});
