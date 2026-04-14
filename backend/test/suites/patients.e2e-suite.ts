import { state, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';

export function patientsSuite() {
  describe('Patients', () => {
    it('POST /api/patients → create patient', async () => {
      const res = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          rut: '12.345.678-5',
          nombre: 'Paciente Test',
          edad: 35,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
          trabajo: 'Ingeniero',
          domicilio: 'Santiago',
        })
        .expect(201);

      expect(res.body.nombre).toBe('Paciente Test');
      expect(res.body.registrationMode).toBe('COMPLETO');
      expect(res.body.completenessStatus).toBe('VERIFICADA');
      expect(res.body.id).toBeDefined();
      state.patientId = res.body.id;
    });

    it('POST /api/patients/quick → assistant creates an intentionally incomplete patient', async () => {
      const res = await req()
        .post('/api/patients/quick')
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({
          nombre: 'Paciente Recepción',
          rutExempt: true,
          rutExemptReason: 'Extranjero sin identificación chilena',
        })
        .expect(201);

      expect(res.body.nombre).toBe('Paciente Recepción');
      expect(res.body.edad).toBeNull();
      expect(res.body.sexo).toBeNull();
      expect(res.body.prevision).toBeNull();
      expect(res.body.registrationMode).toBe('RAPIDO');
      expect(res.body.completenessStatus).toBe('INCOMPLETA');
      expect(res.body.demographicsMissingFields).toEqual(expect.arrayContaining(['edad', 'sexo', 'prevision']));
      state.quickPatientId = res.body.id;
    });

    it('GET /api/patients → list patients', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/patients/:id → get patient', async () => {
      const res = await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      expect(res.body.nombre).toBe('Paciente Test');
      expect(res.body.history).toBeDefined();
    });

    it('PUT /api/patients/:id → update patient', async () => {
      const res = await req()
        .put(`/api/patients/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ nombre: 'Paciente Actualizado', edad: 36 })
        .expect(200);

      expect(res.body.nombre).toBe('Paciente Actualizado');
      expect(res.body.edad).toBe(36);
    });

    it('PUT /api/patients/:id/history → rejects malformed history payloads', async () => {
      await req()
        .put(`/api/patients/${state.patientId}/history`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          antecedentesMedicos: {
            texto: 'Hipertensión arterial',
            severidad: 'alta',
          },
        })
        .expect(400);
    });

    it('PUT /api/patients/:id/history → sanitizes and persists the patient master history', async () => {
      const res = await req()
        .put(`/api/patients/${state.patientId}/history`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          antecedentesMedicos: {
            texto: '  Hipertensión arterial en tratamiento  ',
            items: ['HTA', 'HTA', '  '],
          },
          alergias: {
            items: ['Penicilina', ' Penicilina ', 'Polen'],
          },
          medicamentos: {
            texto: '  Losartán 50 mg cada 12 horas  ',
          },
        })
        .expect(200);

      expect(JSON.parse(res.body.antecedentesMedicos)).toEqual({
        texto: 'Hipertensión arterial en tratamiento',
        items: ['HTA'],
      });
      expect(JSON.parse(res.body.alergias)).toEqual({
        items: ['Penicilina', 'Polen'],
      });
      expect(JSON.parse(res.body.medicamentos)).toEqual({
        texto: 'Losartán 50 mg cada 12 horas',
      });
    });

    it('PUT /api/patients/:id/history → assigned assistant can edit patient master history', async () => {
      const res = await req()
        .put(`/api/patients/${state.patientId}/history`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({
          antecedentesFamiliares: {
            texto: 'Diabetes mellitus en madre',
          },
        })
        .expect(200);

      expect(JSON.parse(res.body.antecedentesFamiliares)).toEqual({
        texto: 'Diabetes mellitus en madre',
      });
    });

    it('PUT /api/patients/:id/admin → assigned assistant can edit patient admin fields', async () => {
      const res = await req()
        .put(`/api/patients/${state.patientId}/admin`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({
          trabajo: 'Ingeniero clínico',
        })
        .expect(200);

      expect(res.body.trabajo).toBe('Ingeniero clínico');
    });

    it('PUT /api/patients/:id/admin → assistant completes quick registration and leaves it pending medical verification', async () => {
      const res = await req()
        .put(`/api/patients/${state.quickPatientId}/admin`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({
          edad: 28,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          trabajo: 'Técnica en laboratorio',
        })
        .expect(200);

      expect(res.body.completenessStatus).toBe('PENDIENTE_VERIFICACION');
      expect(res.body.demographicsVerifiedAt).toBeNull();
      expect(res.body.demographicsVerifiedById).toBeNull();
      expect(res.body.demographicsMissingFields).toEqual([]);
    });

    it('GET /api/encounters/stats/dashboard → exposes operational patient completeness counts', async () => {
      const res = await req()
        .get('/api/encounters/stats/dashboard')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.counts.patientPendingVerification).toBeGreaterThanOrEqual(1);
      expect(res.body.counts.patientVerified).toBeGreaterThanOrEqual(1);
      expect(res.body.counts.patientNonVerified).toBeGreaterThanOrEqual(res.body.counts.patientPendingVerification);
    });

    it('GET /api/patients?completenessStatus=... → filters rows and returns operational summary counts', async () => {
      const res = await req()
        .get('/api/patients?completenessStatus=PENDIENTE_VERIFICACION')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.every((patient: any) => patient.completenessStatus === 'PENDIENTE_VERIFICACION')).toBe(true);
      expect(res.body.data.some((patient: any) => patient.id === state.quickPatientId)).toBe(true);
      expect(res.body.summary.pendingVerification).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.verified).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.totalPatients).toBeGreaterThan(res.body.data.length);
    });

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

    it('GET /api/patients/:id/admin-summary → admin gets a reduced non-clinical patient view', async () => {
      const res = await req()
        .get(`/api/patients/${state.patientId}/admin-summary`)
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(200);

      expect(res.body.nombre).toBe('Paciente Actualizado');
      expect(res.body.metrics.encounterCount).toBe(0);
      expect(res.body.createdBy).toMatchObject({
        id: state.medicoUserId,
        nombre: 'Dr. Updated',
        email: 'medico@test.com',
      });
      expect(res.body.centroMedico).toBeNull();
      expect(res.body.history).toBeUndefined();
      expect(res.body.problems).toBeUndefined();
      expect(res.body.tasks).toBeUndefined();
    });

    it('GET /api/patients/:id/admin-summary → medico gets 403 because the view is administrative only', async () => {
      await req()
        .get(`/api/patients/${state.patientId}/admin-summary`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(403);
    });

    it('GET /api/patients?search=Actualizado → search works', async () => {
      const res = await req()
        .get('/api/patients?search=Actualizado')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.data.length).toBe(1);
    });

    it('DELETE /api/patients/:id → archive patient', async () => {
      const res = await req()
        .delete(`/api/patients/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.message).toBe('Paciente archivado correctamente');
    });

    it('GET /api/patients/:id → 404 when patient is archived', async () => {
      await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(404);
    });

    it('POST /api/patients/:id/restore → restore archived patient', async () => {
      const res = await req()
        .post(`/api/patients/${state.patientId}/restore`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(201);

      expect(res.body.message).toBe('Paciente restaurado correctamente');
    });

    it('GET /api/patients/:id → available again after restore', async () => {
      const res = await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      expect(res.body.id).toBe(state.patientId);
    });
  });
}
