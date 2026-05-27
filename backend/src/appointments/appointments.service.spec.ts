import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

jest.mock('../common/utils/patient-access', () => ({
  assertPatientAccess: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../patients/patients-identifiers', () => ({
  PATIENT_ENCRYPTED_IDENTIFIER_SELECT: { nombreEnc: true, rutEnc: true },
  withPatientIdentifiers: jest.fn((patient) => ({ ...patient, nombre: 'Paciente Agenda', rut: '11.111.111-1' })),
}));

describe('AppointmentsService', () => {
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const medicoUser = { id: 'med-1', role: 'MEDICO', isAdmin: false };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates an appointment linked to a patient in medico scope', async () => {
    const prisma = {
      appointment: {
        create: jest.fn().mockResolvedValue({
          id: 'appt-1',
          medicoId: 'med-1',
          patientId: 'pat-1',
          startAt: new Date('2026-05-27T13:00:00.000Z'),
          endAt: new Date('2026-05-27T13:30:00.000Z'),
          status: 'PROGRAMADA',
          title: 'Control',
          notes: null,
          createdAt: new Date('2026-05-27T12:00:00.000Z'),
          patient: { id: 'pat-1', nombreEnc: 'cipher', rutEnc: 'cipher' },
        }),
      },
    };
    const service = new AppointmentsService(prisma as never, audit as never);

    const result = await service.create(
      {
        medicoId: 'med-1',
        patientId: 'pat-1',
        startAt: '2026-05-27T13:00:00.000Z',
        endAt: '2026-05-27T13:30:00.000Z',
        title: 'Control',
      },
      medicoUser as never,
    );

    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          medicoId: 'med-1',
          patientId: 'pat-1',
          title: 'Control',
          createdById: 'med-1',
        }),
      }),
    );
    expect(result.patient).toEqual(expect.objectContaining({ nombre: 'Paciente Agenda' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE' }));
  });

  it('rejects appointments outside the user medico scope', async () => {
    const service = new AppointmentsService({ appointment: { create: jest.fn() } } as never, audit as never);

    await expect(
      service.create(
        {
          medicoId: 'med-2',
          startAt: '2026-05-27T13:00:00.000Z',
          endAt: '2026-05-27T13:30:00.000Z',
        },
        medicoUser as never,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects invalid appointment time ranges', async () => {
    const service = new AppointmentsService({ appointment: { create: jest.fn() } } as never, audit as never);

    await expect(
      service.create(
        {
          medicoId: 'med-1',
          startAt: '2026-05-27T13:30:00.000Z',
          endAt: '2026-05-27T13:00:00.000Z',
        },
        medicoUser as never,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
