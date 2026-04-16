import { state, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';
import { authenticator } from '@otplib/v12-adapter';

const TEST_BOOTSTRAP_TOKEN = 'bootstrap-token-e2e-0123456789abcdef';

export function authSuite() {
  describe('Auth - Bootstrap', () => {
    it('GET /api/auth/bootstrap → empty DB', async () => {
      process.env.BOOTSTRAP_TOKEN = TEST_BOOTSTRAP_TOKEN;
      const res = await req().get('/api/auth/bootstrap').expect(200);
      expect(res.body.isEmpty).toBe(true);
      expect(res.body.userCount).toBe(0);
      expect(res.body.requiresBootstrapToken).toBe(true);
    });
  });

  describe('Auth - Register Admin', () => {
    it('POST /api/auth/register → rejects first admin without bootstrap token', async () => {
      await req()
        .post('/api/auth/register')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
          nombre: 'Admin Test',
          role: 'ADMIN',
        })
        .expect(403);
    });

    it('POST /api/auth/register → rejects first admin with invalid bootstrap token', async () => {
      await req()
        .post('/api/auth/register')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
          nombre: 'Admin Test',
          role: 'ADMIN',
          bootstrapToken: 'bootstrap-token-e2e-invalid-secret',
        })
        .expect(403);
    });

    it('POST /api/auth/register → first user becomes admin with bootstrap token', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({
          email: 'admin@test.com',
          password: 'Admin123',
          nombre: 'Admin Test',
          role: 'ADMIN',
          bootstrapToken: TEST_BOOTSTRAP_TOKEN,
        })
        .expect(201);

      expect(res.body.message).toBe('Registro exitoso');
      expect(res.body.user.email).toBe('admin@test.com');
      expect(res.body.user.role).toBe('ADMIN');
      state.adminCookies = extractCookies(res);
      expect(state.adminCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/auth/me → returns admin user', async () => {
      const res = await req().get('/api/auth/me').set('Cookie', cookieHeader(state.adminCookies)).expect(200);

      expect(res.body.email).toBe('admin@test.com');
      expect(res.body.isAdmin).toBe(true);
    });

    it('GET /api/health/sqlite → 200 for admin with operational payload', async () => {
      const res = await req().get('/api/health/sqlite').set('Cookie', cookieHeader(state.adminCookies)).expect(200);

      expect(['ok', 'degraded']).toContain(res.body.status);
      expect(res.body.database?.status).toBe('ok');
      expect(res.body.sqlite).toBeDefined();
      expect(typeof res.body.sqlite.enabled).toBe('boolean');
    });
  });

  describe('Auth - Register Medico', () => {
    it('POST /api/auth/register → rejects public registration after bootstrap', async () => {
      await req()
        .post('/api/auth/register')
        .send({
          email: 'medico@test.com',
          password: 'Medico123',
          nombre: 'Dr. Test',
          role: 'MEDICO',
        })
        .expect(403);
    });

    it('POST /api/users/invitations → admin can invite medico', async () => {
      const res = await req()
        .post('/api/users/invitations')
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          email: 'medico@test.com',
          role: 'MEDICO',
        })
        .expect(201);

      expect(res.body.token).toBeDefined();
      expect(res.body.emailSent).toBe(false);
      expect(res.body.inviteUrl).toBe(`http://localhost:5555/register?token=${res.body.token}`);
      state.medicoInvitationToken = res.body.token;
    });

    it('GET /api/auth/invitations/:token → validates invitation', async () => {
      const res = await req().get(`/api/auth/invitations/${state.medicoInvitationToken}`).expect(200);

      expect(res.body.email).toBe('medico@test.com');
      expect(res.body.role).toBe('MEDICO');
    });

    it('POST /api/users/invitations → admin can create a second pending invitation', async () => {
      const res = await req()
        .post('/api/users/invitations')
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          email: 'medico-revoked@test.com',
          role: 'MEDICO',
        })
        .expect(201);

      state.revokedInvitationId = res.body.id;
      state.revokedInvitationToken = res.body.token;
    });

    it('GET /api/users/invitations → admin lists pending invitations', async () => {
      const res = await req().get('/api/users/invitations').set('Cookie', cookieHeader(state.adminCookies)).expect(200);

      const invitation = res.body.find((item: any) => item.id === state.revokedInvitationId);

      expect(invitation).toBeDefined();
      expect(invitation.revokedAt).toBeNull();
      expect(invitation.acceptedAt).toBeNull();
    });

    it('DELETE /api/users/invitations/:id → admin revokes pending invitation', async () => {
      const res = await req()
        .delete(`/api/users/invitations/${state.revokedInvitationId}`)
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.id).toBe(state.revokedInvitationId);
      expect(res.body.revokedAt).toBeDefined();
    });

    it('GET /api/auth/invitations/:token → rejects revoked invitation', async () => {
      await req().get(`/api/auth/invitations/${state.revokedInvitationToken}`).expect(403);
    });

    it('POST /api/auth/register → medico user with invitation', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({
          email: 'medico@test.com',
          password: 'Medico123',
          nombre: 'Dr. Test',
          role: 'MEDICO',
          invitationToken: state.medicoInvitationToken,
        })
        .expect(201);

      expect(res.body.user.email).toBe('medico@test.com');
      expect(res.body.user.role).toBe('MEDICO');
      state.medicoCookies = extractCookies(res);
    });

    it('GET /api/auth/me → returns medico user', async () => {
      const res = await req().get('/api/auth/me').set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      expect(res.body.email).toBe('medico@test.com');
      expect(res.body.role).toBe('MEDICO');
      state.medicoUserId = res.body.id;
    });
  });

  describe('Auth - Register Assistant', () => {
    it('POST /api/users → admin can create assigned assistant', async () => {
      const res = await req()
        .post('/api/users')
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          email: 'assistant@test.com',
          password: 'Assist123',
          nombre: 'Asistente Test',
          role: 'ASISTENTE',
          medicoId: state.medicoUserId,
        })
        .expect(201);

      state.assistantUserId = res.body.id;
      expect(res.body.email).toBe('assistant@test.com');
      expect(res.body.medicoId).toBe(state.medicoUserId);
    });

    it('POST /api/auth/login → assistant can login', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'assistant@test.com', password: 'Assist123' })
        .expect(200);

      expect(res.body.user.email).toBe('assistant@test.com');
      expect(res.body.user.role).toBe('ASISTENTE');
      state.assistantCookies = extractCookies(res);
      expect(state.assistantCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/auth/me → returns assigned assistant user', async () => {
      const res = await req().get('/api/auth/me').set('Cookie', cookieHeader(state.assistantCookies)).expect(200);

      expect(res.body.role).toBe('ASISTENTE');
      expect(res.body.medicoId).toBe(state.medicoUserId);
    });
  });

  describe('Auth - Login', () => {
    it('POST /api/auth/login → valid credentials', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'Medico123' })
        .expect(200);

      expect(res.body.message).toBe('Inicio de sesión exitoso');
      expect(res.body.user.email).toBe('medico@test.com');
      state.medicoCookies = extractCookies(res);
    });

    it('POST /api/auth/login → invalid credentials', async () => {
      await req().post('/api/auth/login').send({ email: 'medico@test.com', password: 'WrongPass1' }).expect(401);
    });
  });

  describe('Auth - Profile', () => {
    it('PATCH /api/auth/profile → update name', async () => {
      const res = await req()
        .patch('/api/auth/profile')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ nombre: 'Dr. Updated' })
        .expect(200);

      expect(res.body.nombre).toBe('Dr. Updated');
    });

    it('POST /api/auth/change-password → wrong current password', async () => {
      await req()
        .post('/api/auth/change-password')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ currentPassword: 'WrongPass1', newPassword: 'NewPass123' })
        .expect(409);
    });

    it('POST /api/auth/change-password → rejects spaces in new password', async () => {
      await req()
        .post('/api/auth/change-password')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ currentPassword: 'Medico123', newPassword: 'New Pass123' })
        .expect(400);
    });

    it('POST /api/auth/change-password → success with dot in password', async () => {
      const res = await req()
        .post('/api/auth/change-password')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ currentPassword: 'Medico123', newPassword: 'New.Pass123' })
        .expect(200);

      expect(res.body.message).toBe('Contraseña actualizada correctamente');
    });

    it('POST /api/auth/login → works with new password', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'New.Pass123' })
        .expect(200);

      state.medicoCookies = extractCookies(res);
    });
  });

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
  });

  describe('Auth - 2FA', () => {
    it('POST /api/auth/2fa/setup → medico can provision secret', async () => {
      const res = await req()
        .post('/api/auth/2fa/setup')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(201);

      expect(typeof res.body.secret).toBe('string');
      expect(res.body.secret.length).toBeGreaterThan(0);
      expect(typeof res.body.qrCodeDataUrl).toBe('string');
      state.medicoTotpSecret = res.body.secret;
    });

    it('POST /api/auth/2fa/enable → medico enables 2FA with valid code', async () => {
      const code = authenticator.generate(state.medicoTotpSecret);

      const res = await req()
        .post('/api/auth/2fa/enable')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ code })
        .expect(200);

      expect(res.body.message).toBe('2FA habilitado correctamente');
    });

    it('POST /api/auth/login → returns temp token when 2FA is enabled', async () => {
      const res = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'New.Pass123' })
        .expect(200);

      expect(res.body.requires2FA).toBe(true);
      expect(typeof res.body.tempToken).toBe('string');
      state.medicoTempToken = res.body.tempToken;
    });

    it('POST /api/auth/2fa/verify → rejects invalid TOTP code', async () => {
      await req()
        .post('/api/auth/2fa/verify')
        .send({ tempToken: state.medicoTempToken, code: '000000' })
        .expect(401);
    });

    it('POST /api/auth/2fa/verify → rejects expired temp token', async () => {
      await req()
        .post('/api/auth/2fa/verify')
        .send({ tempToken: 'expired.invalid.token', code: '123456' })
        .expect(401);
    });

    it('POST /api/auth/2fa/verify → exchanges temp token for auth cookies', async () => {
      const loginRes = await req()
        .post('/api/auth/login')
        .send({ email: 'medico@test.com', password: 'New.Pass123' })
        .expect(200);

      expect(loginRes.body.requires2FA).toBe(true);
      expect(typeof loginRes.body.tempToken).toBe('string');
      state.medicoTempToken = loginRes.body.tempToken;

      const code = authenticator.generate(state.medicoTotpSecret);

      const res = await req()
        .post('/api/auth/2fa/verify')
        .send({ tempToken: state.medicoTempToken, code })
        .expect(200);

      expect(res.body.message).toBe('Verificación 2FA exitosa');
      expect(res.body.user.email).toBe('medico@test.com');

      state.medicoCookies = extractCookies(res);
      expect(state.medicoCookies.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/auth/2fa/verify → rejects reused temp token', async () => {
      const code = authenticator.generate(state.medicoTotpSecret);

      await req()
        .post('/api/auth/2fa/verify')
        .send({ tempToken: state.medicoTempToken, code })
        .expect(401);
    });
  });
}
