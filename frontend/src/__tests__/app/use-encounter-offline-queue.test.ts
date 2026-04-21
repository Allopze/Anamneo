import { persistRecoverableOfflineConflict } from '@/app/(dashboard)/atenciones/[id]/useEncounterOfflineQueue';

const apiGetMock = jest.fn();
const writeEncounterSectionConflictMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

jest.mock('@/lib/encounter-draft', () => ({
  writeEncounterSectionConflict: (...args: any[]) => writeEncounterSectionConflictMock(...args),
}));

describe('persistRecoverableOfflineConflict', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists a recoverable local copy using the latest server section state', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        sections: [
          {
            sectionKey: 'OBSERVACIONES',
            data: { observaciones: '', notasInternas: '' },
            updatedAt: '2026-04-08T12:00:00.000Z',
          },
        ],
      },
    });

    await expect(
      persistRecoverableOfflineConflict({
        encounterId: 'enc-1',
        localData: { observaciones: '', notasInternas: 'Nota offline' },
        sectionKey: 'OBSERVACIONES',
        userId: 'med-1',
      }),
    ).resolves.toBe(true);

    expect(writeEncounterSectionConflictMock).toHaveBeenCalledWith(
      expect.objectContaining({
        encounterId: 'enc-1',
        userId: 'med-1',
        sectionKey: 'OBSERVACIONES',
        localData: { observaciones: '', notasInternas: 'Nota offline' },
        serverData: { observaciones: '', notasInternas: '' },
        serverUpdatedAt: '2026-04-08T12:00:00.000Z',
      }),
    );
  });

  it('returns false when the section no longer exists on the server', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        sections: [],
      },
    });

    await expect(
      persistRecoverableOfflineConflict({
        encounterId: 'enc-1',
        localData: { notasInternas: 'Nota offline' },
        sectionKey: 'OBSERVACIONES',
        userId: 'med-1',
      }),
    ).resolves.toBe(false);

    expect(writeEncounterSectionConflictMock).not.toHaveBeenCalled();
  });
});
