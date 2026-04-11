import { isNetworkError } from '@/lib/offline-queue';

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
