import { state, req, cookieHeader } from '../helpers/e2e-setup';

export function patientsHistoryAdminSuite() {
  describe('Patients history and admin flows', () => {
    it('POST /api/patients/:id/verify-demographics → doctor verifies a completed quick registration', async () => {
      const res = await req()
        .post(`/api/patients/${state.quickPatientId}/verify-demographics`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(201);

      expect(res.body.registrationMode).toBe('RAPIDO');
      expect(res.body.completenessStatus).toBe('VERIFICADA');
      expect(res.body.demographicsVerifiedAt).toBeTruthy();
      expect(res.body.demographicsVerifiedById).toBeDefined();
    });

    it('GET /api/patients/:id/admin-summary → keeps the real assistant as creator for quick registrations', async () => {
      const res = await req()
        .get(`/api/patients/${state.quickPatientId}/admin-summary`)
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.createdBy).toMatchObject({
        id: state.assistantUserId,
        nombre: 'Asistente Test',
        email: 'assistant@test.com',
      });
    });

    it('PUT /api/patients/:id/history → admin gets 403 because history is clinical', async () => {
      await req()
        .put(`/api/patients/${state.patientId}/history`)
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          antecedentesPersonales: {
            texto: 'Observación administrativa validada por admin',
          },
        })
        .expect(403);
    });

    it('GET /api/patients/:id → admin gets 403 because the detail is clinical', async () => {
      await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(state.adminCookies)).expect(403);
    });

    it('GET /api/patients/:id/clinical-summary → admin gets 403 because the summary is clinical', async () => {
      await req()
        .get(`/api/patients/${state.patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(403);
    });

    it('GET /api/patients/:id/admin-summary → medico gets 403 because the view is administrative only', async () => {
      await req()
        .get(`/api/patients/${state.patientId}/admin-summary`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(403);
    });

    it('GET /api/patients/possible-duplicates → admin gets 403 because the check is clinical', async () => {
      await req()
        .get('/api/patients/possible-duplicates')
        .query({ rut: '12.345.678-5' })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(403);
    });
  });
}
