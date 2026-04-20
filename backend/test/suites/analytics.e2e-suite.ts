import * as bcrypt from 'bcrypt';
import { cookieHeader, extractCookies, prisma, req, state } from '../helpers/e2e-setup';

const ANALYTICS_DIAGNOSIS_LABEL = 'Analitica E2E Dolor Abdominal';
const ANALYTICS_MEDICATION_LABEL = 'Paracetamol Analitica E2E';

async function markIdentificationSectionComplete(encounterId: string) {
  const encounterRes = await req()
    .get(`/api/encounters/${encounterId}`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .expect(200);

  const identification = encounterRes.body.sections.find((section: any) => section.sectionKey === 'IDENTIFICACION');

  await req()
    .put(`/api/encounters/${encounterId}/sections/IDENTIFICACION`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({
      data: identification.data,
      completed: true,
    })
    .expect(200);
}

async function createCompletedAnalyticsEncounter() {
  const createRes = await req()
    .post(`/api/encounters/patient/${state.patientId}`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({})
    .expect(201);

  const encounterId = createRes.body.id as string;

  await markIdentificationSectionComplete(encounterId);

  await req()
    .put(`/api/encounters/${encounterId}/sections/MOTIVO_CONSULTA`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({
      data: {
        texto: 'Dolor abdominal postprandial con vómitos para validación analítica E2E.',
      },
      completed: true,
    })
    .expect(200);

  await req()
    .put(`/api/encounters/${encounterId}/sections/ANAMNESIS_PROXIMA`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({
      data: {
        relatoAmpliado: 'Paciente refiere dolor abdominal y vómitos luego de comer.',
        sintomasAsociados: 'Vómitos postprandiales',
        perfilDolorAbdominal: {
          presente: true,
          vomitos: true,
          asociadoComida: 'SI',
          notas: 'Cuadro creado por suite E2E de analítica.',
        },
      },
      completed: true,
    })
    .expect(200);

  await req()
    .put(`/api/encounters/${encounterId}/sections/EXAMEN_FISICO`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({
      data: {
        abdomen: 'Abdomen blando, doloroso en epigastrio, sin signos de irritación peritoneal.',
      },
      completed: true,
    })
    .expect(200);

  await req()
    .put(`/api/encounters/${encounterId}/sections/SOSPECHA_DIAGNOSTICA`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({
      data: {
        sospechas: [
          {
            id: 'dx-analytics-e2e',
            diagnostico: ANALYTICS_DIAGNOSIS_LABEL,
            codigoCie10: 'K30',
            notas: 'Caso controlado para suite E2E.',
          },
        ],
      },
      completed: true,
    })
    .expect(200);

  await req()
    .put(`/api/encounters/${encounterId}/sections/TRATAMIENTO`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({
      data: {
        plan: 'Manejo sintomático y control según evolución.',
        medicamentosEstructurados: [
          {
            id: 'med-analytics-e2e',
            nombre: ANALYTICS_MEDICATION_LABEL,
            dosis: '500 mg',
            frecuencia: 'cada 8 h',
            duracion: '3 días',
            indicacion: 'Dolor abdominal postprandial',
          },
        ],
        examenesEstructurados: [
          {
            id: 'exam-analytics-e2e',
            nombre: 'Perfil hepático',
            indicacion: 'Descartar compromiso asociado',
            estado: 'PENDIENTE',
          },
        ],
      },
      completed: true,
    })
    .expect(200);

  const completeRes = await req()
    .post(`/api/encounters/${encounterId}/complete`)
    .set('Cookie', cookieHeader(state.medicoCookies))
    .send({
      closureNote: 'Encuentro completado por suite E2E para validar analítica clínica.',
    })
    .expect(201);

  expect(completeRes.body.status).toBe('COMPLETADO');

  return encounterId;
}

export function analyticsSuite() {
  describe('Analytics', () => {
    let medicoAdminCookies: string[] = [];
    let analyticsEncounterId = '';

    beforeAll(async () => {
      analyticsEncounterId = await createCompletedAnalyticsEncounter();

      await prisma.user.create({
        data: {
          email: 'medico-analytics-admin@test.com',
          passwordHash: await bcrypt.hash('Medico.Admin123', 10),
          nombre: 'Medico Analytics Admin',
          role: 'MEDICO',
          isAdmin: true,
        },
      });

      const loginRes = await req()
        .post('/api/auth/login')
        .send({ email: 'medico-analytics-admin@test.com', password: 'Medico.Admin123' })
        .expect(200);

      medicoAdminCookies = extractCookies(loginRes);
    });

    it('GET /api/analytics/clinical/summary → medico returns scoped summary for a matching completed encounter', async () => {
      const res = await req()
        .get('/api/analytics/clinical/summary')
        .query({
          condition: ANALYTICS_DIAGNOSIS_LABEL,
          source: 'SOSPECHA_DIAGNOSTICA',
          followUpDays: 30,
          limit: 10,
        })
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.filters.condition).toBe(ANALYTICS_DIAGNOSIS_LABEL);
      expect(res.body.summary.matchedPatients).toBe(1);
      expect(res.body.summary.matchedEncounters).toBe(1);
      expect(res.body.summary.structuredTreatmentCount).toBe(1);
      expect(res.body.summary.reconsultWithinWindowCount).toBe(0);
      expect(res.body.summary.treatmentAdjustmentCount).toBe(0);
      expect(res.body.summary.resolvedProblemCount).toBe(0);
      expect(res.body.summary.alertAfterIndexCount).toBe(0);
      expect(res.body.topConditions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: ANALYTICS_DIAGNOSIS_LABEL,
            encounterCount: 1,
            patientCount: 1,
          }),
        ]),
      );
      expect(res.body.treatmentPatterns.medications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: ANALYTICS_MEDICATION_LABEL,
            encounterCount: 1,
            patientCount: 1,
          }),
        ]),
      );
      expect(res.body.cohortBreakdown.foodRelation).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: 'Asociado a comida',
            encounterCount: 1,
            patientCount: 1,
          }),
        ]),
      );
      expect(String(analyticsEncounterId)).not.toBe('');
    });

    it('GET /api/analytics/clinical/summary → assistant gets 403', async () => {
      await req()
        .get('/api/analytics/clinical/summary')
        .query({ condition: ANALYTICS_DIAGNOSIS_LABEL })
        .set('Cookie', cookieHeader(state.assistantCookies))
        .expect(403);
    });

    it('GET /api/analytics/clinical/summary → admin gets 403', async () => {
      await req()
        .get('/api/analytics/clinical/summary')
        .query({ condition: ANALYTICS_DIAGNOSIS_LABEL })
        .set('Cookie', cookieHeader(state.adminCookies))
        .expect(403);
    });

    it('GET /api/analytics/clinical/summary → MEDICO with isAdmin=true gets 403 from service enforcement', async () => {
      await req()
        .get('/api/analytics/clinical/summary')
        .query({ condition: ANALYTICS_DIAGNOSIS_LABEL })
        .set('Cookie', cookieHeader(medicoAdminCookies))
        .expect(403);
    });

    it('GET /api/analytics/clinical/cases → medico returns matching cases for medication drill-down', async () => {
      const res = await req()
        .get('/api/analytics/clinical/cases')
        .query({
          condition: ANALYTICS_DIAGNOSIS_LABEL,
          source: 'SOSPECHA_DIAGNOSTICA',
          focusType: 'MEDICATION',
          focusValue: ANALYTICS_MEDICATION_LABEL,
          page: 1,
        })
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.pagination.total).toBe(1);
      expect(res.body.focus).toEqual({
        type: 'MEDICATION',
        value: ANALYTICS_MEDICATION_LABEL,
      });
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounterId: analyticsEncounterId,
            patientId: state.patientId,
            patientName: 'Paciente Actualizado',
            medications: expect.arrayContaining([ANALYTICS_MEDICATION_LABEL]),
          }),
        ]),
      );
    });
  });
}