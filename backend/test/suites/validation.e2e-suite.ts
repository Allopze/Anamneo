import { state, prisma, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';
import {
  ENCOUNTER_SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../../src/common/utils/encounter-section-meta';

export function validationSuite() {
  describe('Validation', () => {
    it('POST /api/auth/register → invalid email format', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'Valid123', nombre: 'Test' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/auth/register → weak password', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'weak@test.com', password: '12345678', nombre: 'Test' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/auth/register → rejects public registration with valid password but no invitation', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'dotpass@test.com', password: 'Dot.Pass123', nombre: 'Dot Test', role: 'MEDICO' })
        .expect(403);

      expect(String(res.body.message)).toContain('invitación');
    });

    it('POST /api/auth/register → rejects password with spaces', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({ email: 'spacepass@test.com', password: 'Space Pass123', nombre: 'Space Test', role: 'MEDICO' })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('POST /api/patients → missing required fields', async () => {
      await req().post('/api/patients').set('Cookie', cookieHeader(state.medicoCookies)).send({ nombre: 'Test' }).expect(400);
    });
  });

  describe('Patient Data Isolation', () => {
    let medico2Cookies: string[] = [];
    let medico2UserId: string;
    let medico2PatientId: string;
    let medico2InvitationToken: string;
    let leakedEncounterId: string;
    let leakedProblemId: string;
    let leakedTaskId: string;
    let leakedStandaloneProblemId: string;
    let leakedStandaloneTaskId: string;
    let leakedConsentId: string;
    let leakedAlertId: string;

    it('Admin invites a second medico', async () => {
      const res = await req()
        .post('/api/users/invitations')
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          email: 'medico2@test.com',
          role: 'MEDICO',
        })
        .expect(201);

      medico2InvitationToken = res.body.token;
      expect(medico2InvitationToken).toBeDefined();
    });

    it('Register a second medico with invitation', async () => {
      const res = await req()
        .post('/api/auth/register')
        .send({
          email: 'medico2@test.com',
          password: 'Medico2x1',
          nombre: 'Dr. Segundo',
          role: 'MEDICO',
          invitationToken: medico2InvitationToken,
        })
        .expect(201);

      medico2Cookies = extractCookies(res);
      const medico2User = await prisma.user.findUniqueOrThrow({
        where: { email: 'medico2@test.com' },
        select: { id: true },
      });
      medico2UserId = medico2User.id;
      expect(medico2Cookies.length).toBeGreaterThanOrEqual(2);
    });

    it('Second medico creates own patient', async () => {
      const res = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(medico2Cookies))
        .send({
          nombre: 'Paciente Medico2',
          fechaNacimiento: '1986-09-14',
          edad: 40,
          sexo: 'FEMENINO',
          prevision: 'ISAPRE',
        })
        .expect(201);

      medico2PatientId = res.body.id;
      expect(medico2PatientId).toBeDefined();
    });

    it('Second medico cannot see first medico patients in list', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(medico2Cookies)).expect(200);

      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).not.toContain(state.patientId);
      expect(ids).toContain(medico2PatientId);
    });

    it('First medico cannot see second medico patients in list', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).toContain(state.patientId);
      expect(ids).not.toContain(medico2PatientId);
    });

    it('Second medico cannot access first medico patient by ID', async () => {
      await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(medico2Cookies)).expect(404);
    });

    it('First medico cannot access second medico patient by ID', async () => {
      await req().get(`/api/patients/${medico2PatientId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(404);
    });

    it('Second medico cannot create encounters for a patient outside their scope', async () => {
      await req()
        .post(`/api/encounters/patient/${state.patientId}`)
        .set('Cookie', cookieHeader(medico2Cookies))
        .send({})
        .expect(404);
    });

    it('Patient timeline and derived summary do not leak encounters from another medico scope', async () => {
      const visibleEncounterCountBeforeLeak = await prisma.encounter.count({
        where: {
          patientId: state.patientId,
          medicoId: state.medicoUserId,
        },
      });

      const leakedEncounter = await prisma.encounter.create({
        data: {
          patientId: state.patientId,
          medicoId: medico2UserId,
          createdById: medico2UserId,
          status: 'COMPLETADO',
          createdAt: new Date('2026-04-01T00:00:00.000Z'),
        },
      });
      leakedEncounterId = leakedEncounter.id;

      const timelineRes = await req()
        .get(`/api/patients/${state.patientId}/encounters?page=1&limit=10`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(timelineRes.body.data.some((item: any) => item.id === leakedEncounterId)).toBe(false);

      const summaryRes = await req()
        .get(`/api/patients/${state.patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(summaryRes.body.latestEncounterSummary?.encounterId).not.toBe(leakedEncounterId);
      expect(summaryRes.body.counts.totalEncounters).toBe(visibleEncounterCountBeforeLeak);
    });

    it('First medico still gets 404 when trying to open another medico encounter directly', async () => {
      await req().get(`/api/encounters/${leakedEncounterId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(404);
    });

    it('Patient detail, encounter detail, summary and task inbox do not leak problems or tasks from another medico scope', async () => {
      const [linkedProblem, linkedTask, standaloneProblem, standaloneTask] = await prisma.$transaction([
        prisma.patientProblem.create({
          data: {
            patientId: state.patientId,
            encounterId: leakedEncounterId,
            createdById: medico2UserId,
            label: 'Problema filtrado',
            status: 'ACTIVO',
          },
        }),
        prisma.encounterTask.create({
          data: {
            patientId: state.patientId,
            encounterId: leakedEncounterId,
            createdById: medico2UserId,
            title: 'Seguimiento filtrado',
            status: 'PENDIENTE',
          },
        }),
        prisma.patientProblem.create({
          data: {
            patientId: state.patientId,
            createdById: medico2UserId,
            label: 'Problema standalone filtrado',
            status: 'ACTIVO',
          },
        }),
        prisma.encounterTask.create({
          data: {
            patientId: state.patientId,
            createdById: medico2UserId,
            title: 'Seguimiento standalone filtrado',
            status: 'PENDIENTE',
          },
        }),
      ]);

      leakedProblemId = linkedProblem.id;
      leakedTaskId = linkedTask.id;
      leakedStandaloneProblemId = standaloneProblem.id;
      leakedStandaloneTaskId = standaloneTask.id;

      const patientRes = await req()
        .get(`/api/patients/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);
      expect(patientRes.body.problems.map((item: any) => item.id)).toContain(state.patientProblemId);
      expect(patientRes.body.problems.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedProblemId, leakedStandaloneProblemId]),
      );
      expect(patientRes.body.tasks.map((item: any) => item.id)).toContain(state.patientTaskId);
      expect(patientRes.body.tasks.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );

      const encounterRes = await req()
        .get(`/api/encounters/${state.encounterId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);
      expect(encounterRes.body.patient.problems.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedProblemId, leakedStandaloneProblemId]),
      );
      expect(encounterRes.body.patient.tasks.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );

      const summaryRes = await req()
        .get(`/api/patients/${state.patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);
      expect(summaryRes.body.activeProblems.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedProblemId, leakedStandaloneProblemId]),
      );
      expect(summaryRes.body.pendingTasks.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );

      const inboxRes = await req().get('/api/patients/tasks').set('Cookie', cookieHeader(state.medicoCookies)).expect(200);
      expect(inboxRes.body.data.map((item: any) => item.id)).not.toEqual(
        expect.arrayContaining([leakedTaskId, leakedStandaloneTaskId]),
      );
    });

    it('First medico cannot attach new problems or tasks to another medico encounter on the same patient', async () => {
      await req()
        .post(`/api/patients/${state.patientId}/problems`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          label: 'No debe vincularse',
          encounterId: leakedEncounterId,
        })
        .expect(400);

      await req()
        .post(`/api/patients/${state.patientId}/tasks`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          title: 'No debe vincularse',
          encounterId: leakedEncounterId,
        })
        .expect(400);
    });

    it('First medico cannot update another medico problem or task even if the patient is otherwise visible', async () => {
      await req()
        .put(`/api/patients/problems/${leakedStandaloneProblemId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          notes: 'Intento fuera de scope',
        })
        .expect(404);

      await req()
        .put(`/api/patients/tasks/${leakedStandaloneTaskId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          status: 'COMPLETADA',
        })
        .expect(404);
    });

    it('Encounter-linked consents and alerts do not leak across medicos sharing the same patient', async () => {
      const [consent, alert] = await prisma.$transaction([
        prisma.informedConsent.create({
          data: {
            patientId: state.patientId,
            encounterId: leakedEncounterId,
            type: 'PROCEDIMIENTO',
            description: 'Consentimiento del encuentro filtrado',
            grantedById: medico2UserId,
          },
        }),
        prisma.clinicalAlert.create({
          data: {
            patientId: state.patientId,
            encounterId: leakedEncounterId,
            type: 'GENERAL',
            severity: 'ALTA',
            title: 'Alerta del encuentro filtrado',
            message: 'No deberia verse desde otro medico',
            createdById: medico2UserId,
          },
        }),
      ]);

      leakedConsentId = consent.id;
      leakedAlertId = alert.id;

      const consentsRes = await req()
        .get(`/api/consents/patient/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(consentsRes.body.map((item: any) => item.id)).not.toContain(leakedConsentId);

      const alertsRes = await req()
        .get(`/api/alerts/patient/${state.patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(alertsRes.body.map((item: any) => item.id)).not.toContain(leakedAlertId);

      await req()
        .post(`/api/consents/${leakedConsentId}/revoke`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ reason: 'Intento fuera de scope' })
        .expect(404);

      await req()
        .post(`/api/alerts/${leakedAlertId}/acknowledge`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({})
        .expect(404);

      const medico2ConsentsRes = await req()
        .get(`/api/consents/patient/${state.patientId}`)
        .set('Cookie', cookieHeader(medico2Cookies))
        .expect(200);

      expect(medico2ConsentsRes.body.map((item: any) => item.id)).toContain(leakedConsentId);

      const medico2AlertsRes = await req()
        .get(`/api/alerts/patient/${state.patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(medico2Cookies))
        .expect(200);

      expect(medico2AlertsRes.body.map((item: any) => item.id)).toContain(leakedAlertId);
    });

    it('First medico cannot update second medico patient history or admin fields', async () => {
      await req()
        .put(`/api/patients/${medico2PatientId}/history`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          antecedentesMedicos: {
            texto: 'Intento fuera de alcance',
          },
        })
        .expect(404);

      await req()
        .put(`/api/patients/${medico2PatientId}/admin`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          domicilio: 'No debería persistirse',
        })
        .expect(404);
    });

    it('Admin can see all patients', async () => {
      const res = await req().get('/api/patients').set('Cookie', cookieHeader(state.adminCookies)).expect(200);

      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).toContain(state.patientId);
      expect(ids).toContain(medico2PatientId);
    });
  });

  describe('Patient Timeline Volume', () => {
    it('GET /api/patients/:id/encounters → keeps pagination metadata and payload bounded with many encounters', async () => {
      const patientRes = await req()
        .post('/api/patients')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          nombre: 'Paciente Volumen',
          fechaNacimiento: '1974-02-11',
          edad: 52,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
        })
        .expect(201);

      const volumePatientId = patientRes.body.id;
      const baseDate = new Date('2026-04-01T08:00:00.000Z');

      for (let index = 0; index < 14; index += 1) {
        const encounterDate = new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000);

        await prisma.encounter.create({
          data: {
            patientId: volumePatientId,
            medicoId: state.medicoUserId,
            createdById: state.medicoUserId,
            status: 'COMPLETADO',
            reviewStatus: 'REVISADA_POR_MEDICO',
            createdAt: encounterDate,
            updatedAt: encounterDate,
            completedAt: encounterDate,
            sections: {
              create: ENCOUNTER_SECTION_ORDER.map((sectionKey, sectionIndex) => ({
                sectionKey,
                data: JSON.stringify(
                  sectionKey === 'MOTIVO_CONSULTA'
                    ? { texto: `Control ${index + 1}` }
                    : sectionKey === 'OBSERVACIONES'
                      ? {
                          observaciones: `Nota ${index + 1}`,
                          resumenClinico: `Resumen ${index + 1}`,
                        }
                      : sectionKey === 'EXAMEN_FISICO'
                        ? {
                            signosVitales: {
                              peso: String(70 + index),
                              temperatura: '36.5',
                            },
                          }
                        : {},
                ),
                schemaVersion: getEncounterSectionSchemaVersion(sectionKey),
                completed: sectionIndex < 8,
                updatedAt: encounterDate,
              })),
            },
          },
        });
      }

      const res = await req()
        .get(`/api/patients/${volumePatientId}/encounters?page=2&limit=5`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const payloadSummary = {
        page: res.body.pagination?.page,
        limit: res.body.pagination?.limit,
        total: res.body.pagination?.total,
        totalPages: res.body.pagination?.totalPages,
        itemCount: res.body.data.length,
        firstItemSectionKeys: res.body.data[0]?.sections?.map((section: any) => section.sectionKey),
        firstItemProgress: res.body.data[0]?.progress,
        payloadBytes: Buffer.byteLength(JSON.stringify(res.body)),
      };

      expect(payloadSummary).toMatchInlineSnapshot(`
        {
          "firstItemProgress": {
            "completed": 8,
            "total": 10,
          },
          "firstItemSectionKeys": [
            "IDENTIFICACION",
            "MOTIVO_CONSULTA",
            "ANAMNESIS_PROXIMA",
            "ANAMNESIS_REMOTA",
            "REVISION_SISTEMAS",
            "EXAMEN_FISICO",
            "SOSPECHA_DIAGNOSTICA",
            "TRATAMIENTO",
            "RESPUESTA_TRATAMIENTO",
            "OBSERVACIONES",
          ],
          "itemCount": 5,
          "limit": 5,
          "page": 2,
          "payloadBytes": 16595,
          "total": 14,
          "totalPages": 3,
        }
      `);
      expect(payloadSummary.payloadBytes).toBeLessThan(20000);
    });
  });
}
