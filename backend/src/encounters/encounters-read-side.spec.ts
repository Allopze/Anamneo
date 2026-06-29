import { findEncounterByIdReadModel } from './encounters-read-side';
import { formatEncounterResponse } from './encounters-presenters';

jest.mock('./encounters-presenters', () => ({
  formatEncounterForList: jest.fn(),
  formatEncounterForPatientList: jest.fn(),
  formatEncounterResponse: jest.fn((encounter) => encounter),
}));

describe('findEncounterByIdReadModel', () => {
  it('filters soft-deleted attachments from the encounter read model', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'enc-1',
        medicoId: 'med-1',
        patientId: 'patient-1',
        createdAt: new Date('2026-04-17T12:00:00.000Z'),
        sections: [],
        tasks: [],
        attachments: [],
      })
      .mockResolvedValueOnce(null);

    const prisma = {
      encounter: {
        findFirst,
      },
    } as any;

    const user = { id: 'med-1', role: 'MEDICO' } as const;

    await findEncounterByIdReadModel({
      prisma,
      id: 'enc-1',
      effectiveMedicoId: 'med-1',
      user,
    });

    expect(findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        include: expect.objectContaining({
          attachments: {
            where: { deletedAt: null },
            orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
          },
        }),
      }),
    );
    expect(formatEncounterResponse).toHaveBeenCalled();
  });

  it('skips signature baseline lookup when the editor payload opts out', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'enc-1',
        medicoId: 'med-1',
        patientId: 'patient-1',
        createdAt: new Date('2026-04-17T12:00:00.000Z'),
        sections: [],
        tasks: [],
        attachments: [],
      });

    const prisma = {
      encounter: {
        findFirst,
      },
    } as any;

    const user = { id: 'med-1', role: 'MEDICO' } as const;

    await findEncounterByIdReadModel({
      prisma,
      id: 'enc-1',
      effectiveMedicoId: 'med-1',
      user,
      includeSignatureBaseline: false,
    });

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(formatEncounterResponse).toHaveBeenLastCalledWith(
      expect.objectContaining({ signatureBaseline: null }),
      { viewerRole: 'MEDICO' },
    );
  });

  it('omits secondary aggregates when the editor payload opts out', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'enc-1',
        medicoId: 'med-1',
        patientId: 'patient-1',
        createdAt: new Date('2026-04-17T12:00:00.000Z'),
        sections: [],
      });

    const prisma = {
      encounter: {
        findFirst,
      },
    } as any;

    const user = { id: 'med-1', role: 'MEDICO' } as const;

    await findEncounterByIdReadModel({
      prisma,
      id: 'enc-1',
      effectiveMedicoId: 'med-1',
      user,
      includeSignatureBaseline: false,
      includeAttachments: false,
      includeConsents: false,
      includeTasks: false,
      includeSignatures: false,
      includeSuggestions: false,
    });

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.not.objectContaining({
          attachments: expect.anything(),
          consents: expect.anything(),
          tasks: expect.anything(),
          signatures: expect.anything(),
          suggestions: expect.anything(),
        }),
      }),
    );
    expect(findFirst.mock.calls[0][0].include.patient.include).not.toHaveProperty('tasks');
  });
});
