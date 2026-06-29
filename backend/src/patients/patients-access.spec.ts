import { NotFoundException } from '@nestjs/common';
import { assertPatientAccessScope } from './patients-access';
import { RequestUser } from '../common/utils/medico-id';

describe('patients-access', () => {
  const medicoUser: RequestUser = {
    id: 'med-1',
    role: 'MEDICO',
    isAdmin: false,
  };

  it('throws NotFoundException when patient does not exist', async () => {
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      encounter: {
        findFirst: jest.fn(),
      },
    };

    await expect(
      assertPatientAccessScope({
        prisma: prisma as never,
        user: medicoUser,
        patientId: 'patient-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.encounter.findFirst).not.toHaveBeenCalled();
  });

  it('hides patient when user has no ownership and no encounter in scope', async () => {
    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          createdById: 'med-2',
          archivedAt: null,
          history: {},
          createdBy: { medicoId: 'med-2' },
        }),
      },
      encounter: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      assertPatientAccessScope({
        prisma: prisma as never,
        user: medicoUser,
        patientId: 'patient-1',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.encounter.findFirst).toHaveBeenCalledWith({
      where: { patientId: 'patient-1', medicoId: 'med-1' },
      select: { id: true },
    });
  });

  it('allows patient when there is at least one encounter in user scope', async () => {
    const patient = {
      id: 'patient-1',
      createdById: 'med-2',
      archivedAt: null,
      history: {},
      createdBy: { medicoId: 'med-2' },
    };

    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(patient),
      },
      encounter: {
        findFirst: jest.fn().mockResolvedValue({ id: 'enc-1' }),
      },
    };

    const result = await assertPatientAccessScope({
      prisma: prisma as never,
      user: medicoUser,
      patientId: 'patient-1',
    });

    expect(result).toBe(patient);
  });

  it('allows patient without encounter lookup when user owns the record', async () => {
    const patient = {
      id: 'patient-1',
      createdById: 'med-1',
      archivedAt: null,
      history: {},
      createdBy: { medicoId: 'med-1' },
    };

    const prisma = {
      patient: {
        findUnique: jest.fn().mockResolvedValue(patient),
      },
      encounter: {
        findFirst: jest.fn(),
      },
    };

    const result = await assertPatientAccessScope({
      prisma: prisma as never,
      user: medicoUser,
      patientId: 'patient-1',
    });

    expect(result).toBe(patient);
    expect(prisma.encounter.findFirst).not.toHaveBeenCalled();
  });
});
