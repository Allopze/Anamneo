import axios from 'axios';
import { shouldPreserveLocalSessionOnBootstrapError } from '@/lib/session-bootstrap';

describe('shouldPreserveLocalSessionOnBootstrapError', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true for network errors without response', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(shouldPreserveLocalSessionOnBootstrapError({ request: {}, response: undefined })).toBe(true);
  });

  it('returns false for server-side bootstrap errors', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(shouldPreserveLocalSessionOnBootstrapError({ request: {}, response: { status: 503 } })).toBe(false);
  });

  it('returns false for 401 auth errors', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(shouldPreserveLocalSessionOnBootstrapError({ request: {}, response: { status: 401 } })).toBe(false);
  });

  it('returns false for setup errors without request', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(shouldPreserveLocalSessionOnBootstrapError({ message: 'invalid config' })).toBe(false);
  });

  it('returns false for non-Axios errors', () => {
    jest.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    expect(shouldPreserveLocalSessionOnBootstrapError(new Error('boom'))).toBe(false);
  });
});