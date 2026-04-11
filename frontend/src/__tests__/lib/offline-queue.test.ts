import { filterPendingSavesByUser, isNetworkError } from '@/lib/offline-queue';

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
});
