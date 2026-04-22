import { state, req, extractCookies, cookieHeader, prisma } from '../helpers/e2e-setup';
import { authenticator } from '@otplib/v12-adapter';

const TEST_BOOTSTRAP_TOKEN = 'bootstrap-token-e2e-0123456789abcdef';

export function authLoginProfileSuite() {
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

}
