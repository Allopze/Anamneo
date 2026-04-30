import { rebuildPatientClinicalSearchProjection } from './patient-clinical-search-projection';

describe('rebuildPatientClinicalSearchProjection', () => {
  it('upserts normalized text from searchable sections across encounters', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([
          {
            sections: [
              { data: JSON.stringify({ texto: 'Dolor abdominal' }) },
              { data: JSON.stringify({ sintomas: ['Nauseas'] }) },
            ],
          },
        ]),
      },
      patientClinicalSearch: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any;

    await rebuildPatientClinicalSearchProjection(prisma, {
      patientId: 'patient-1',
      medicoId: 'med-1',
    });

    expect(prisma.patientClinicalSearch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId_medicoId: { patientId: 'patient-1', medicoId: 'med-1' } },
        create: expect.objectContaining({
          patientId: 'patient-1',
          medicoId: 'med-1',
          text: expect.stringContaining('dolor abdominal'),
        }),
        update: expect.objectContaining({
          text: expect.stringContaining('nauseas'),
        }),
      }),
    );
    expect(prisma.patientClinicalSearch.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes the projection when searchable text is empty', async () => {
    const prisma = {
      encounter: {
        findMany: jest.fn().mockResolvedValue([{ sections: [{ data: '{}' }] }]),
      },
      patientClinicalSearch: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    } as any;

    await rebuildPatientClinicalSearchProjection(prisma, {
      patientId: 'patient-1',
      medicoId: 'med-1',
    });

    expect(prisma.patientClinicalSearch.deleteMany).toHaveBeenCalledWith({
      where: { patientId: 'patient-1', medicoId: 'med-1' },
    });
    expect(prisma.patientClinicalSearch.upsert).not.toHaveBeenCalled();
  });
});
