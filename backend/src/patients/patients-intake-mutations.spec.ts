import { BadRequestException } from '@nestjs/common';
import {
  createPatientMutation,
  createQuickPatientMutation,
} from './patients-intake-mutations';
import { RequestUser } from '../common/utils/medico-id';
import { calculateAgeFromBirthDate } from '../common/utils/local-date';

describe('patients-intake-mutations', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects full patient creation with a future birth date', async () => {
    const prisma = {
      patient: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await expect(
      createPatientMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        createPatientDto: {
          nombre: 'Paciente Demo',
          edad: 35,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          fechaNacimiento: tomorrow,
        },
        userId: 'med-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('rejects full patient creation without birth date', async () => {
    const prisma = {
      patient: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    await expect(
      createPatientMutation({
        prisma: prisma as never,
        auditService: auditService as never,
        createPatientDto: {
          nombre: 'Paciente Demo',
          edad: 35,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
        },
        userId: 'med-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.patient.create).not.toHaveBeenCalled();
  });

  it('creates full patient and emits CREATE audit record', async () => {
    const createdPatient = {
      id: 'patient-1',
      nombre: 'Paciente Demo',
      rut: null,
      rutExempt: false,
      rutExemptReason: null,
      fechaNacimiento: new Date('1990-05-10T12:00:00.000Z'),
      edad: 35,
      edadMeses: 2,
      sexo: 'FEMENINO',
      trabajo: 'Profesora',
      prevision: 'FONASA',
      domicilio: 'Calle 123',
      centroMedico: 'Centro',
      registrationMode: 'COMPLETO',
      completenessStatus: 'VERIFICADA',
      demographicsVerifiedAt: new Date('2026-04-16T06:00:00.000Z'),
      demographicsVerifiedById: 'med-1',
      createdAt: new Date('2026-04-16T06:00:00.000Z'),
      updatedAt: new Date('2026-04-16T06:00:00.000Z'),
      history: { id: 'history-1' },
    };

    const tx = {
      patient: {
        create: jest.fn().mockResolvedValue(createdPatient),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      patient: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const result = await createPatientMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      createPatientDto: {
        nombre: 'Paciente Demo',
        edad: 35,
        edadMeses: 2,
        sexo: 'FEMENINO',
        prevision: 'FONASA',
        fechaNacimiento: '1990-05-10',
        trabajo: 'Profesora',
        domicilio: 'Calle 123',
        centroMedico: 'Centro',
      },
      userId: 'med-1',
    });

    expect(tx.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: 'med-1',
          registrationMode: 'COMPLETO',
          nombreEnc: expect.stringMatching(/^enc:v1:/),
          domicilioEnc: expect.stringMatching(/^enc:v1:/),
          fechaNacimiento: new Date('1990-05-10T12:00:00.000Z'),
        }),
        include: { history: true },
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Patient',
        entityId: 'patient-1',
        action: 'CREATE',
      }),
      tx,
    );
    expect(result.id).toBe('patient-1');
    expect(result.registrationMode).toBe('COMPLETO');
  });

  it('derives edad from fechaNacimiento when edad is omitted', async () => {
    const expectedAge = calculateAgeFromBirthDate('1990-05-10');
    const createdPatient = {
      id: 'patient-2',
      nombre: 'Paciente Sin Edad',
      rut: null,
      rutExempt: true,
      rutExemptReason: 'Sin documento',
      fechaNacimiento: new Date('1990-05-10T12:00:00.000Z'),
      edad: expectedAge.edad,
      edadMeses: expectedAge.edadMeses,
      sexo: 'FEMENINO',
      trabajo: null,
      prevision: 'FONASA',
      domicilio: null,
      centroMedico: null,
      registrationMode: 'COMPLETO',
      completenessStatus: 'VERIFICADA',
      demographicsVerifiedAt: new Date('2026-04-16T06:00:00.000Z'),
      demographicsVerifiedById: 'med-1',
      createdAt: new Date('2026-04-16T06:00:00.000Z'),
      updatedAt: new Date('2026-04-16T06:00:00.000Z'),
      history: { id: 'history-2' },
    };

    const tx = {
      patient: {
        create: jest.fn().mockResolvedValue(createdPatient),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      patient: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const result = await createPatientMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      // edad intentionally omitted — it must be derived from fechaNacimiento.
      createPatientDto: {
        nombre: 'Paciente Sin Edad',
        sexo: 'FEMENINO',
        prevision: 'FONASA',
        fechaNacimiento: '1990-05-10',
        rutExempt: true,
        rutExemptReason: 'Sin documento',
      } as never,
      userId: 'med-1',
    });

    // The derived age is persisted AND drives demographic completeness (VERIFICADA),
    // so omitting edad does not leave the ficha blocked on a missing-edad field.
    expect(tx.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          edad: expectedAge.edad,
          edadMeses: expectedAge.edadMeses,
          registrationMode: 'COMPLETO',
          completenessStatus: 'VERIFICADA',
        }),
      }),
    );
    expect(result.id).toBe('patient-2');
  });

  it('stores patient birth dates using the shared date-only convention', async () => {
    const createdPatient = {
      id: 'patient-2',
      nombre: 'Paciente Demo',
      rut: null,
      rutExempt: false,
      rutExemptReason: null,
      fechaNacimiento: new Date('1990-05-10T12:00:00.000Z'),
      edad: 35,
      edadMeses: 0,
      sexo: 'FEMENINO',
      trabajo: null,
      prevision: 'FONASA',
      domicilio: null,
      centroMedico: null,
      registrationMode: 'COMPLETO',
      completenessStatus: 'VERIFICADA',
      demographicsVerifiedAt: new Date('2026-04-16T06:00:00.000Z'),
      demographicsVerifiedById: 'med-1',
      createdAt: new Date('2026-04-16T06:00:00.000Z'),
      updatedAt: new Date('2026-04-16T06:00:00.000Z'),
      history: { id: 'history-2' },
    };

    const tx = {
      patient: {
        create: jest.fn().mockResolvedValue(createdPatient),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      patient: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await createPatientMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      createPatientDto: {
        nombre: 'Paciente Demo',
        edad: 35,
        sexo: 'FEMENINO',
        prevision: 'FONASA',
        fechaNacimiento: '1990-05-10',
      },
      userId: 'med-1',
    });

    expect(tx.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fechaNacimiento: new Date('1990-05-10T12:00:00.000Z'),
          edad: expect.any(Number),
          edadMeses: expect.any(Number),
        }),
      }),
    );
  });

  it('creates quick patient with RAPIDO mode and null demographics', async () => {
    const createdQuickPatient = {
      id: 'patient-quick-1',
      nombre: 'Paciente Rapido',
      rut: null,
      rutExempt: false,
      rutExemptReason: null,
      fechaNacimiento: null,
      edad: null,
      edadMeses: null,
      sexo: null,
      trabajo: null,
      prevision: null,
      domicilio: null,
      centroMedico: null,
      registrationMode: 'RAPIDO',
      completenessStatus: 'INCOMPLETA',
      demographicsVerifiedAt: null,
      demographicsVerifiedById: null,
      createdAt: new Date('2026-04-16T06:10:00.000Z'),
      updatedAt: new Date('2026-04-16T06:10:00.000Z'),
      history: { id: 'history-quick-1' },
    };

    const tx = {
      patient: {
        create: jest.fn().mockResolvedValue(createdQuickPatient),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      patient: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const user: RequestUser = {
      id: 'assistant-1',
      role: 'ASISTENTE',
      isAdmin: false,
      medicoId: 'med-1',
    };

    const result = await createQuickPatientMutation({
      prisma: prisma as never,
      auditService: auditService as never,
      createPatientDto: {
        nombre: 'Paciente Rapido',
      },
      user,
    });

    expect(tx.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: 'assistant-1',
          registrationMode: 'RAPIDO',
          edad: null,
          sexo: null,
          prevision: null,
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'Patient',
        entityId: 'patient-quick-1',
        action: 'CREATE',
        diff: expect.objectContaining({ quick: true }),
      }),
      tx,
    );
    expect(result.id).toBe('patient-quick-1');
    expect(result.registrationMode).toBe('RAPIDO');
  });
});
