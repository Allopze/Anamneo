import { req } from '../helpers/e2e-setup';

export function healthSuite() {
  describe('Health', () => {
    it('GET /api/health → 200', async () => {
      const res = await req().get('/api/health').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /api/health/sqlite → 401 when unauthenticated', async () => {
      await req().get('/api/health/sqlite').expect(401);
    });
  });
}
