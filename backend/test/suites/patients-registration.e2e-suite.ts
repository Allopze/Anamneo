import { state, req, cookieHeader } from '../helpers/e2e-setup';

export function patientsRegistrationSuite() {
  describe('Patients registration flows', () => {
    it('POST /api/patients → create patient', async () => {
      const res = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          rut: '12.345.678-5',
          nombre: 'Paciente Test',
          fechaNacimiento: '1990-05-12',
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

    it('GET /api/patients/possible-duplicates → assistant can detect duplicates by rut and birth date', async () => {
      const res = await req()
        .get('/api/patients/possible-duplicates')
        .query({
          rut: '12.345.678-5',
          nombre: 'Paciente Test',
          fechaNacimiento: '1990-05-12',
        })
        .set('Cookie', cookieHeader(state.assistantCookies))
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: state.patientId,
            matchReasons: expect.arrayContaining(['same_rut', 'same_name_birth_date']),
          }),
        ]),
      );
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
        .send({
          nombre: 'Paciente Actualizado',
          edad: 36,
          telefono: '+56 9 1111 2222',
          email: 'paciente.actualizado@test.com',
        })
        .expect(200);

      expect(res.body.nombre).toBe('Paciente Actualizado');
      expect(res.body.edad).toBe(36);
      expect(res.body.telefono).toBe('+56 9 1111 2222');
      expect(res.body.email).toBe('paciente.actualizado@test.com');
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
          contactoEmergenciaNombre: 'Ana Familiar',
          contactoEmergenciaTelefono: '+56 9 3333 4444',
        })
        .expect(200);

      expect(res.body.trabajo).toBe('Ingeniero clínico');
      expect(res.body.contactoEmergenciaNombre).toBe('Ana Familiar');
      expect(res.body.contactoEmergenciaTelefono).toBe('+56 9 3333 4444');
    });

    it('PUT /api/patients/:id/admin → assistant completes quick registration and leaves it pending medical verification', async () => {
      const res = await req()
        .put(`/api/patients/${state.quickPatientId}/admin`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({
          fechaNacimiento: '1996-08-20',
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

    it('POST /api/patients → creates a duplicate candidate with complementary contact data', async () => {
      const res = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          nombre: 'Paciente Actualizado',
          fechaNacimiento: '1990-05-12',
          edad: 35,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
          rutExempt: true,
          rutExemptReason: 'Documento en regularización',
          contactoEmergenciaNombre: 'Carlos Familiar',
          contactoEmergenciaTelefono: '+56 9 7777 8888',
        })
        .expect(201);

      expect(res.body.contactoEmergenciaNombre).toBe('Carlos Familiar');
      state.duplicatePatientId = res.body.id;
    });
  });
}
