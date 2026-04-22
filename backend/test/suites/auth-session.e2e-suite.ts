import { state, req, extractCookies, cookieHeader, prisma } from '../helpers/e2e-setup';
import { authenticator } from '@otplib/v12-adapter';

const TEST_BOOTSTRAP_TOKEN = 'bootstrap-token-e2e-0123456789abcdef';

export function authSessionManagementSuite() {
  describe('Auth - Logout', () => {
    it('POST /api/auth/logout → clears cookies', async () => {
      const res = await req().post('/api/auth/logout').expect(200);
      expect(res.body.message).toBe('Sesión cerrada');
    });

    it('GET /api/auth/me → 401 without cookies', async () => {
      await req().get('/api/auth/me').expect(401);
    });

    // Re-login for subsequent tests
    it('re-login medico', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'New.Pass123' })
        .expect(200);

      state.medicoCookies = extractCookies(res);
    });
  });

  describe('Auth - Refresh', () => {
    it('POST /api/auth/refresh → refreshes tokens via cookie', async () => {
      const loginRes = await req()
        .post('/api/auth/login')
        .send({ email: 'admin@test.com', password: 'Admin123' })
        .expect(200);

      const freshCookies = extractCookies(loginRes);
      expect(freshCookies.length).toBeGreaterThanOrEqual(2);

      const hasRefreshCookie = freshCookies.some((c) => c.startsWith('refresh_token='));
      expect(hasRefreshCookie).toBe(true);

      const res = await req().post('/api/auth/refresh').set('Cookie', cookieHeader(freshCookies)).expect(200);

      expect(res.body.message).toBe('Tokens actualizados');
      const newCookies = extractCookies(res);
      expect(newCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/auth/refresh → rejects a session expired by inactivity and revokes it', async () => {
      const loginRes = await req()
        .post('/api/auth/login')
        .send({ email: 'assistant@test.com', password: 'Assist123' })
        .expect(200);

      const staleCookies = extractCookies(loginRes);
      const assistant = await prisma.user.findUniqueOrThrow({
        where: { email: 'assistant@test.com' },
        select: { id: true },
      });
      const session = await prisma.userSession.findFirstOrThrow({
        where: {
          userId: assistant.id,
          revokedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(Date.now() - 16 * 60 * 1000),
        },
      });

      await req()
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(staleCookies))
        .expect(401);

      const revokedSession = await prisma.userSession.findUniqueOrThrow({
        where: { id: session.id },
        select: { revokedAt: true },
      });
      expect(revokedSession.revokedAt).not.toBeNull();
    });
  });

  describe('Auth - Sessions', () => {
    it('GET /api/auth/sessions + DELETE /api/auth/sessions/:id → lists and revokes a remote session', async () => {
      const secondLoginRes = await req()
        .post('/api/auth/login')
        .send({ email: 'assistant@test.com', password: 'Assist123' })
        .expect(200);

      const remoteAssistantCookies = extractCookies(secondLoginRes);

      const res = await req()
        .get('/api/auth/sessions')
        .set('Cookie', cookieHeader(state.assistantCookies))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      const currentSession = res.body.find((session: any) => session.isCurrent === true);
      const remoteSession = res.body.find((session: any) => session.isCurrent === false);

      expect(currentSession).toBeDefined();
      expect(remoteSession).toBeDefined();
      expect(typeof remoteSession.userAgent === 'string' || remoteSession.userAgent === null).toBe(true);

      const revokeRes = await req()
        .delete(`/api/auth/sessions/${remoteSession.id}`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .expect(200);

      expect(revokeRes.body.message).toBe('Sesión revocada');
      expect(revokeRes.body.id).toBe(remoteSession.id);

      await req()
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(remoteAssistantCookies))
        .expect(401);
    });
  });

}
