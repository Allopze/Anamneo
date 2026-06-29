import type { Request } from 'express';
import { buildRequestLogPath, sanitizeRequestPath } from '../utils/request-tracing';

describe('request tracing path sanitization', () => {
  it('drops query strings and masks UUID segments', () => {
    expect(
      sanitizeRequestPath('/api/encounters/123e4567-e89b-12d3-a456-426614174000/sections?tab=notes'),
    ).toBe('/api/encounters/:id/sections');
  });

  it('prefers express route templates when the route metadata is available', () => {
    const req = {
      originalUrl: '/api/patients/123e4567-e89b-12d3-a456-426614174000?include=history',
      baseUrl: '/api/patients',
      route: { path: '/:id' },
    } as Pick<Request, 'originalUrl' | 'baseUrl'> & { route?: { path?: unknown } };

    expect(buildRequestLogPath(req)).toBe('/api/patients/:id');
  });
});