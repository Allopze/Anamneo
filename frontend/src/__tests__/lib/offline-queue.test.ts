import { collapsePendingSaves, enqueueSave, filterPendingSavesByUser, isNetworkError } from '@/lib/offline-queue';
import { usePrivacySettingsStore } from '@/stores/privacy-settings-store';

beforeEach(() => {
  usePrivacySettingsStore.setState({ sharedDeviceMode: false, hasHydrated: true });
});

describe('isNetworkError', () => {
  it('returns true for ERR_NETWORK code', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true);
  });

  it('returns true when response is undefined', () => {
    expect(isNetworkError({ code: 'ECONNABORTED' })).toBe(true);
  });

  it('returns false when response exists', () => {
    expect(isNetworkError({ code: 'ERR_BAD_REQUEST', response: { status: 400 } })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isNetworkError(null)).toBe(false);
  });

  it('returns false for plain string', () => {
    expect(isNetworkError('fail')).toBe(false);
  });
});

describe('filterPendingSavesByUser', () => {
  it('keeps only saves for the active user', () => {
    expect(
      filterPendingSavesByUser(
        [
          {
            id: 1,
            encounterId: 'enc-1',
            sectionKey: 'MOTIVO_CONSULTA',
            data: { texto: 'A' },
            queuedAt: '2026-04-11T10:00:00.000Z',
            userId: 'user-1',
          },
          {
            id: 2,
            encounterId: 'enc-2',
            sectionKey: 'TRATAMIENTO',
            data: { plan: 'B' },
            queuedAt: '2026-04-11T10:01:00.000Z',
            userId: 'user-2',
          },
        ],
        'user-1',
      ),
    ).toEqual([
      expect.objectContaining({
        id: 1,
        encounterId: 'enc-1',
        userId: 'user-1',
      }),
    ]);
  });

  it('preserves offline metadata used for not-applicable retries', () => {
    expect(
      filterPendingSavesByUser(
        [
          {
            id: 3,
            encounterId: 'enc-3',
            sectionKey: 'OBSERVACIONES',
            data: {},
            completed: true,
            notApplicable: true,
            notApplicableReason: 'No corresponde en este control',
            queuedAt: '2026-04-11T10:02:00.000Z',
            userId: 'user-1',
          },
        ],
        'user-1',
      ),
    ).toEqual([
      expect.objectContaining({
        notApplicable: true,
        notApplicableReason: 'No corresponde en este control',
      }),
    ]);
  });
});

describe('collapsePendingSaves', () => {
  it('keeps only the latest pending save per user, encounter and section', () => {
    expect(
      collapsePendingSaves([
        {
          id: 1,
          encounterId: 'enc-1',
          sectionKey: 'MOTIVO_CONSULTA',
          data: { texto: 'Versión vieja' },
          queuedAt: '2026-04-17T10:00:00.000Z',
          userId: 'user-1',
        },
        {
          id: 2,
          encounterId: 'enc-1',
          sectionKey: 'MOTIVO_CONSULTA',
          data: { texto: 'Versión nueva' },
          queuedAt: '2026-04-17T10:05:00.000Z',
          userId: 'user-1',
        },
        {
          id: 3,
          encounterId: 'enc-1',
          sectionKey: 'TRATAMIENTO',
          data: { plan: 'Mantener' },
          queuedAt: '2026-04-17T10:02:00.000Z',
          userId: 'user-1',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 3,
        sectionKey: 'TRATAMIENTO',
      }),
      expect.objectContaining({
        id: 2,
        sectionKey: 'MOTIVO_CONSULTA',
        data: { texto: 'Versión nueva' },
      }),
    ]);
  });
});

describe('shared-device mode', () => {
  it('rejects offline queue persistence when shared-device mode is enabled', async () => {
    usePrivacySettingsStore.setState({ sharedDeviceMode: true, hasHydrated: true });

    await expect(
      enqueueSave({
        encounterId: 'enc-1',
        sectionKey: 'MOTIVO_CONSULTA',
        data: { texto: 'Sin conexión' },
        queuedAt: new Date().toISOString(),
        userId: 'user-1',
      }),
    ).rejects.toThrow('El modo equipo compartido desactiva el guardado offline local');
  });
});
