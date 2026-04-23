import { state, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';

const TEST_BOOTSTRAP_TOKEN = 'bootstrap-token-e2e-0123456789abcdef';

export function authRegistrationSuite() {
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
      expect(res.body.sqlite.restoreDrill).toEqual(
        expect.objectContaining({
          frequencyDays: expect.any(Number),
          isDue: expect.any(Boolean),
        }),
      );
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

}
