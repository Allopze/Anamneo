import { state, prisma, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';
import { todayLocalDateOnly } from '../../src/common/utils/local-date';

export function adminSuite() {
  describe('Admin - Users', () => {
    beforeAll(async () => {
      const res = await req().post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin123' });
      state.adminCookies = extractCookies(res);
    });

    it('GET /api/users → admin can list users', async () => {
      const res = await req().get('/api/users').set('Cookie', cookieHeader(state.adminCookies)).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('POST /api/users/:id/reset-password → rejects spaces in temporary password', async () => {
      await req()
        .post(`/api/users/${state.medicoUserId}/reset-password`)
        .send({ temporaryPassword: 'Nueva Clave123' })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(400);
    });

    it('POST /api/users/:id/reset-password → admin can reset password with dot', async () => {
      const res = await req()
        .post(`/api/users/${state.medicoUserId}/reset-password`)
        .send({ temporaryPassword: 'Nueva.Clave123' })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(201);

      expect(res.body.message).toBe('Contraseña restablecida correctamente');
    });

    it('GET /api/users → non-admin gets 403', async () => {
      await req().get('/api/users').set('Cookie', cookieHeader(state.medicoCookies)).expect(403);
    });

    it('GET /api/settings → admin can read settings', async () => {
      const res = await req().get('/api/settings').set('Cookie', cookieHeader(state.adminCookies)).expect(200);

      expect(res.body['smtp.password']).toBeUndefined();
      expect(res.body['smtp.passwordConfigured']).toBe('false');
    });

    it('PUT /api/settings → admin can save invitation html template', async () => {
      const template =
        '<html><body><img src="{{logoUrl}}" alt="{{clinicName}}" /><a href="{{inviteUrl}}">Entrar</a></body></html>';
      const res = await req()
        .put('/api/settings')
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          smtpPassword: 'SMTP.SuperSecret123',
          invitationTemplateHtml: template,
          invitationSubject: 'Invitacion {{roleLabel}} - {{clinicName}}',
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);

      const settingsRes = await req().get('/api/settings').set('Cookie', cookieHeader(state.adminCookies)).expect(200);

      expect(settingsRes.body['smtp.password']).toBeUndefined();
      expect(settingsRes.body['smtp.passwordConfigured']).toBe('true');
      expect(settingsRes.body['email.invitationTemplateHtml']).toBe(template);
      expect(settingsRes.body['email.invitationSubject']).toBe('Invitacion {{roleLabel}} - {{clinicName}}');

      const persistedSmtpPassword = await prisma.setting.findUnique({
        where: { key: 'smtp.password' },
      });

      expect(persistedSmtpPassword?.value).toBeDefined();
      expect(persistedSmtpPassword?.value).not.toBe('SMTP.SuperSecret123');
      expect(persistedSmtpPassword?.value.startsWith('enc:v1:')).toBe(true);
    });

    it('POST /api/mail/test-invitation → admin gets diagnostic response when smtp is missing', async () => {
      const res = await req()
        .post('/api/mail/test-invitation')
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          email: 'admin@test.com',
          clinicName: 'Anamneo Test',
          appPublicUrl: 'http://localhost:5555',
          invitationSubject: 'Prueba {{clinicName}}',
        })
        .expect(201);

      expect(res.body.sent).toBe(false);
      expect(String(res.body.reason)).toContain('SMTP');
    });

    it('GET /api/settings → non-admin gets 403', async () => {
      await req().get('/api/settings').set('Cookie', cookieHeader(state.medicoCookies)).expect(403);
    });
  });

  describe('Admin - Audit', () => {
    it('GET /api/patients/export/csv → admin can export patient registry', async () => {
      const res = await req()
        .get('/api/patients/export/csv')
        .set('x-request-id', 'audit-export-request')
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['x-request-id']).toBe('audit-export-request');
      expect(String(res.text)).toContain('Nombre,RUT,Edad');
    });

    it('GET /api/audit → admin can filter same-day logs with inclusive dateTo', async () => {
      const today = todayLocalDateOnly();

      const res = await req()
        .get('/api/audit')
        .query({ page: 1, limit: 30, dateFrom: today, dateTo: today })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination?.page).toBe(1);
    });

    it('GET /api/audit?action=EXPORT&entityType=Encounter → returns encounter export logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'EXPORT', entityType: 'Encounter', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === state.encounterId)).toBe(true);
    });

    it('GET /api/audit?action=DOWNLOAD&entityType=Attachment → returns attachment download logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'DOWNLOAD', entityType: 'Attachment', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === state.attachmentId)).toBe(true);
    });

    it('GET /api/audit?action=EXPORT&entityType=PatientExport → returns CSV export logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'EXPORT', entityType: 'PatientExport', requestId: 'audit-export-request', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === 'csv')).toBe(true);
      expect(res.body.data.every((item: any) => item.requestId?.includes('audit-export-request'))).toBe(true);
    });

    it('GET /api/audit?reason=PATIENT_EXPORT_CSV&result=SUCCESS → filters by audit catalog semantics', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ reason: 'PATIENT_EXPORT_CSV', result: 'SUCCESS', entityType: 'PatientExport', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((item: any) => item.reason === 'PATIENT_EXPORT_CSV')).toBe(true);
      expect(res.body.data.every((item: any) => item.result === 'SUCCESS')).toBe(true);
    });

    it('GET /api/audit?action=PASSWORD_CHANGED&entityType=User → returns admin password reset logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ action: 'PASSWORD_CHANGED', entityType: 'User', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.entityId === state.medicoUserId)).toBe(true);
    });

    it('GET /api/audit?entityType=UserInvitation → returns invitation lifecycle logs', async () => {
      const res = await req()
        .get('/api/audit')
        .query({ entityType: 'UserInvitation', page: 1, limit: 30 })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      const invitationActions = res.body.data.map((item: any) => item.action);
      expect(invitationActions).toContain('CREATE');
      expect(invitationActions).toContain('UPDATE');
    });

    it('GET /api/audit/integrity/verify → admin can verify the audit chain', async () => {
      const res = await req()
        .get('/api/audit/integrity/verify')
        .query({ limit: 5000 })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.valid).toBe(true);
      expect(res.body.checked).toBeGreaterThan(0);
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GET /api/audit → non-admin gets 403', async () => {
      await req().get('/api/audit').set('Cookie', cookieHeader(state.medicoCookies)).expect(403);
    });

    it('GET /api/audit/integrity/verify → non-admin gets 403', async () => {
      await req().get('/api/audit/integrity/verify').set('Cookie', cookieHeader(state.medicoCookies)).expect(403);
    });
  });
}
