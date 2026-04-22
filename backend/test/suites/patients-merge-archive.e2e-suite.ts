import { state, req, cookieHeader } from '../helpers/e2e-setup';

export function patientsMergeArchiveSuite() {
  describe('Patients merge and archive flows', () => {
    it('PUT /api/patients/:id/history → duplicate candidate can carry complementary history', async () => {
      const res = await req()
        .put(`/api/patients/${state.duplicatePatientId}/history`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          antecedentesSociales: {
            texto: 'Vive con familia y cuenta con red de apoyo',
          },
        })
        .expect(200);

      expect(JSON.parse(res.body.antecedentesSociales)).toEqual({
        texto: 'Vive con familia y cuenta con red de apoyo',
      });
    });

    it('POST /api/encounters/patient/:id → duplicate candidate can have encounters before merge', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${state.duplicatePatientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({})
        .expect(201);

      expect(res.body.patientId).toBe(state.duplicatePatientId);
    });

    it('POST /api/patients/:id/merge → doctor merges duplicate data into the current patient', async () => {
      const res = await req()
        .post(`/api/patients/${state.patientId}/merge`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ sourcePatientId: state.duplicatePatientId })
        .expect(201);

      expect(res.body.patient.id).toBe(state.patientId);
      expect(res.body.patient.contactoEmergenciaNombre).toBe('Ana Familiar');
      expect(res.body.patient.contactoEmergenciaTelefono).toBe('+56 9 3333 4444');
      expect(res.body.counts.encountersMoved).toBe(1);
    });

    it('GET /api/patients/:id → merged patient keeps complementary history and remains canonical', async () => {
      const res = await req()
        .get(`/api/patients/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.contactoEmergenciaNombre).toBe('Ana Familiar');
      expect(JSON.parse(res.body.history.antecedentesMedicos)).toEqual({
        texto: 'Hipertensión arterial en tratamiento',
        items: ['HTA'],
      });
      expect(JSON.parse(res.body.history.alergias)).toEqual({
        items: ['Penicilina', 'Polen'],
      });
      expect(JSON.parse(res.body.history.medicamentos)).toEqual({
        texto: 'Losartán 50 mg cada 12 horas',
      });
      expect(JSON.parse(res.body.history.antecedentesSociales)).toEqual({
        texto: 'Vive con familia y cuenta con red de apoyo',
      });
    });

    it('GET /api/patients/:id → merged source patient is archived and no longer visible', async () => {
      await req()
        .get(`/api/patients/${state.duplicatePatientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(404);
    });

    it('POST /api/encounters/patient/:id → create an in-progress encounter before archive', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({})
        .expect(201);

      expect(res.body.status).toBe('EN_PROGRESO');
      state.encounterId = res.body.id;
    });

    it('DELETE /api/patients/:id → archive patient', async () => {
      const res = await req()
        .delete(`/api/patients/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.message).toBe('Paciente archivado correctamente');
      expect(res.body.autoCancelledEncounterCount).toBe(1);
    });

    it('GET /api/patients/:id → 404 when patient is archived', async () => {
      await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(404);
    });

    it('GET /api/patients?archived=ARCHIVED → archived patient becomes visible in archived inbox', async () => {
      const res = await req()
        .get('/api/patients?archived=ARCHIVED')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.data.some((patient: any) => patient.id === state.patientId)).toBe(true);
      expect(res.body.data.every((patient: any) => Boolean(patient.archivedAt))).toBe(true);
    });

    it('POST /api/patients/:id/restore → restore archived patient', async () => {
      const res = await req()
        .post(`/api/patients/${state.patientId}/restore`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(201);

      expect(res.body.message).toBe('Paciente restaurado correctamente');
      expect(res.body.restoredEncounterCount).toBe(1);
    });

    it('GET /api/patients/:id → available again after restore', async () => {
      const res = await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      expect(res.body.id).toBe(state.patientId);
    });

    it('GET /api/patients/:id/encounters → auto-cancelled encounter is reopened on restore', async () => {
      const res = await req()
        .get(`/api/patients/${state.patientId}/encounters?page=1&limit=10`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const restoredEncounter = res.body.data.find((encounter: any) => encounter.id === state.encounterId);
      expect(restoredEncounter?.status).toBe('EN_PROGRESO');
    });
  });
}
