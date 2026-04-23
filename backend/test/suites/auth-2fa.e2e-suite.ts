import { state, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';
import { authenticator } from '@otplib/v12-adapter';

export function authTwoFactorSuite() {
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
