import * as bcrypt from 'bcrypt';
import { cookieHeader, extractCookies, prisma, req, state } from '../helpers/e2e-setup';
import { ANALYTICS_DIAGNOSIS_LABEL, ANALYTICS_MEDICATION_LABEL, createCompletedAnalyticsEncounter } from './analytics.helpers';

export function analyticsSuite() {
  describe('Analytics', () => {
    let medicoAdminCookies: string[] = [];
    let analyticsEncounterId = '';
    let sharedPatientAlertId = '';
    let sharedPatientLevelAlertId = '';
    let sharedPatientAlertOwnerCookies: string[] = [];
    let sharedPatientAlertOwnerUserId = '';

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

      const sharedMedico = await prisma.user.create({
        data: {
          email: 'medico-analytics-shared@test.com',
          passwordHash: await bcrypt.hash('Medico.Shared123', 10),
          nombre: 'Medico Analytics Shared',
          role: 'MEDICO',
          isAdmin: false,
        },
        select: { id: true },
      });

      const sharedMedicoLoginRes = await req()
        .post('/api/auth/login')
        .send({ email: 'medico-analytics-shared@test.com', password: 'Medico.Shared123' })
        .expect(200);

      sharedPatientAlertOwnerCookies = extractCookies(sharedMedicoLoginRes);
      sharedPatientAlertOwnerUserId = sharedMedico.id;

      const sharedEncounter = await prisma.encounter.create({
        data: {
          patientId: state.patientId,
          medicoId: sharedMedico.id,
          createdById: sharedMedico.id,
          status: 'COMPLETADO',
        },
        select: { id: true },
      });

      const sharedAlert = await prisma.clinicalAlert.create({
        data: {
          patientId: state.patientId,
          encounterId: sharedEncounter.id,
          type: 'GENERAL',
          severity: 'ALTA',
          title: 'Alerta analytics paciente compartido',
          message: 'No debe contarse en la analitica de otro medico',
          createdById: sharedMedico.id,
        },
        select: { id: true },
      });

      sharedPatientAlertId = sharedAlert.id;

      const patientLevelAlert = await prisma.clinicalAlert.create({
        data: {
          patientId: state.patientId,
          encounterId: null,
          type: 'GENERAL',
          severity: 'ALTA',
          title: 'Alerta paciente-nivel compartida',
          message: 'No deberia entrar al summary de otro medico',
          createdById: sharedPatientAlertOwnerUserId,
        },
        select: { id: true },
      });

      sharedPatientLevelAlertId = patientLevelAlert.id;
    });

    it('GET /api/analytics/clinical/summary → medico excludes encounter-linked and patient-level alerts from another medico on a shared patient', async () => {
      const sharedAlertsRes = await req()
        .get(`/api/alerts/patient/${state.patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(sharedPatientAlertOwnerCookies))
        .expect(200);

      expect(sharedAlertsRes.body.map((item: any) => item.id)).toContain(sharedPatientAlertId);
      expect(sharedAlertsRes.body.map((item: any) => item.id)).toContain(sharedPatientLevelAlertId);

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
