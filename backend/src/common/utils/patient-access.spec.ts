import { NotFoundException } from '@nestjs/common';
import { assertLoadedPatientAccess, isClinicalRecordInMedicoScope } from './patient-access';
import type { RequestUser } from './medico-id';

describe('patient-access', () => {
  const medicoUser: RequestUser = {
    id: 'med-1',
    role: 'MEDICO',
    isAdmin: false,
  };

  it('allows an owned patient without encounter fallback', async () => {
    const prisma = {
      encounter: {
        findFirst: jest.fn(),
      },
    };

    const patient = await assertLoadedPatientAccess(
      prisma as never,
      medicoUser,
      'patient-1',
      {
        id: 'patient-1',
        createdById: 'med-1',
        archivedAt: null,
        createdBy: { medicoId: 'med-1' },
      },
    );

    expect(patient.id).toBe('patient-1');
    expect(prisma.encounter.findFirst).not.toHaveBeenCalled();
  });

  it('requires an encounter fallback when the patient is not owned', async () => {
    const prisma = {
      encounter: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      assertLoadedPatientAccess(
        prisma as never,
        medicoUser,
        'patient-1',
        {
          id: 'patient-1',
          createdById: 'med-2',
          archivedAt: null,
          createdBy: { medicoId: 'med-2' },
        },
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.encounter.findFirst).toHaveBeenCalledWith({
      where: { patientId: 'patient-1', medicoId: 'med-1' },
      select: { id: true },
    });
  });

  it('allows clinical records scoped to the same medicoId', () => {
    expect(
      isClinicalRecordInMedicoScope(
        {
          medicoId: 'med-1',
        },
        'med-1',
      ),
    ).toBe(true);
  });

  it('rejects clinical records from another medico outside scope', () => {
    expect(
      isClinicalRecordInMedicoScope(
        {
          medicoId: 'med-2',
        },
        'med-1',
      ),
    ).toBe(false);
  });

  it('rejects clinical records without a medicoId in scope checks', () => {
    expect(
      isClinicalRecordInMedicoScope(
        {
          medicoId: null,
        },
        'med-1',
      ),
    ).toBe(false);
  });
});