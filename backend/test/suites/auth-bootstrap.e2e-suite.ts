import { req } from '../helpers/e2e-setup';

const TEST_BOOTSTRAP_TOKEN = 'bootstrap-token-e2e-0123456789abcdef';

export function authBootstrapSuite() {
  describe('Auth - Bootstrap', () => {
    it('GET /api/auth/bootstrap → empty DB', async () => {
      process.env.BOOTSTRAP_TOKEN = TEST_BOOTSTRAP_TOKEN;
      const res = await req().get('/api/auth/bootstrap').expect(200);
      expect(res.body.isEmpty).toBe(true);
      expect(res.body.userCount).toBe(0);
      expect(res.body.requiresBootstrapToken).toBe(true);
    });
  });

}
