import { state, prisma, alertsService, req, extractCookies, cookieHeader } from '../helpers/e2e-setup';
import {
  ENCOUNTER_SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../../src/common/utils/encounter-section-meta';

export function encountersSuite() {
  describe('Encounters', () => {
    it('POST /api/encounters/patient/:patientId → create encounter', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({})
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('EN_PROGRESO');
      state.encounterId = res.body.id;
    });

    it('POST /api/encounters/patient/:patientId → initializes anamnesis remota as a sanitized snapshot', async () => {
      const res = await req()
        .get(`/api/encounters/${state.encounterId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const anamnesisRemota = res.body.sections.find((section: any) => section.sectionKey === 'ANAMNESIS_REMOTA')?.data;
      expect(anamnesisRemota).toMatchObject({
        readonly: true,
        antecedentesMedicos: {
          texto: 'Hipertensión arterial en tratamiento',
          items: ['HTA'],
        },
        alergias: {
          items: ['Penicilina', 'Polen'],
        },
        medicamentos: {
          texto: 'Losartán 50 mg cada 12 horas',
        },
      });
      expect(anamnesisRemota.id).toBeUndefined();
      expect(anamnesisRemota.patientId).toBeUndefined();
      expect(anamnesisRemota.updatedAt).toBeUndefined();
    });

    it('GET /api/encounters → list encounters', async () => {
      const res = await req().get('/api/encounters').set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/encounters → admin gets 403 because the encounter list is clinical', async () => {
      await req().get('/api/encounters').set('Cookie', cookieHeader(state.adminCookies)).expect(403);
    });

    it('GET /api/encounters/:id → get encounter with sections', async () => {
      const res = await req()
        .get(`/api/encounters/${state.encounterId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.id).toBe(state.encounterId);
      expect(res.body.sections).toBeDefined();
      expect(
        res.body.sections.every(
          (section: any) => section.schemaVersion === getEncounterSectionSchemaVersion(section.sectionKey),
        ),
      ).toBe(true);
      expect(
        res.body.sections.find((section: any) => section.sectionKey === 'OBSERVACIONES')?.data?.resumenClinico,
      ).toBe('');
    });

    it('GET /api/encounters/:id → reports divergence between identification snapshot and patient master data', async () => {
      await req()
        .put(`/api/patients/${state.patientId}/admin`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          prevision: 'ISAPRE',
          domicilio: 'Nueva dirección 456',
        })
        .expect(200);

      const res = await req()
        .get(`/api/encounters/${state.encounterId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.identificationSnapshotStatus?.isSnapshot).toBe(true);
      expect(res.body.identificationSnapshotStatus?.hasDifferences).toBe(true);
      expect(res.body.identificationSnapshotStatus?.differingFields).toEqual(
        expect.arrayContaining(['prevision', 'domicilio']),
      );
    });

    it('PUT /api/encounters/:id/sections/IDENTIFICACION → rejects invalid clinical admin data', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/IDENTIFICACION`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            nombre: 'Paciente Actualizado',
            edad: 'abc',
            sexo: 'DESCONOCIDO',
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/IDENTIFICACION → rejects manual divergence from patient master data', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/IDENTIFICACION`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            nombre: 'Otro nombre',
            edad: 36,
            sexo: 'FEMENINO',
            prevision: 'FONASA',
            rut: '',
            rutExempt: true,
            rutExemptReason: 'Documento no disponible',
            trabajo: '',
            domicilio: '',
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → update section', async () => {
      const res = await req()
        .put(`/api/encounters/${state.encounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: { texto: 'Dolor abdominal agudo' },
          completed: true,
        })
        .expect(200);

      expect(res.body.sectionKey).toBe('MOTIVO_CONSULTA');
      expect(res.body.completed).toBe(true);
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → rejects invalid assisted-classification payload', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            texto: 'Dolor abdominal agudo',
            modoSeleccion: 'BOT',
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/ANAMNESIS_PROXIMA → rejects non-text fields', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/ANAMNESIS_PROXIMA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            inicio: { texto: 'Hace tres días' },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/ANAMNESIS_REMOTA → rejects malformed remote history payloads', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/ANAMNESIS_REMOTA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            readonly: 'true',
            antecedentesMedicos: {
              items: ['HTA', { nombre: 'asma' }],
            },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/REVISION_SISTEMAS → rejects invalid system flags', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/REVISION_SISTEMAS`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            respiratorio: {
              checked: 'true',
              notas: 'Disnea de esfuerzo',
            },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/EXAMEN_FISICO → rejects out-of-range vital signs', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            signosVitales: {
              saturacionOxigeno: '140',
            },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/EXAMEN_FISICO → returns a warning when auto-alert generation fails but the section still saves', async () => {
      const spy = jest.spyOn(alertsService, 'checkVitalSigns').mockRejectedValueOnce(new Error('simulated failure'));

      const res = await req()
        .put(`/api/encounters/${state.encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            signosVitales: {
              presionArterial: '180/120',
              temperatura: '39.6',
            },
          },
          completed: true,
        })
        .expect(200);

      expect(res.body.sectionKey).toBe('EXAMEN_FISICO');
      expect(res.body.warnings).toEqual([
        'La sección se guardó, pero no se pudo completar la verificación automática de alertas por signos vitales.',
      ]);

      spy.mockRestore();
    });

    it('PUT /api/encounters/:id/sections/EXAMEN_FISICO → does not recreate acknowledged auto-alerts for the same critical value', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            signosVitales: {
              temperatura: '39.6',
            },
          },
          completed: true,
        })
        .expect(200);

      const initialAlertsRes = await req()
        .get(`/api/alerts/patient/${state.patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const matchingAlerts = initialAlertsRes.body.filter(
        (alert: any) => alert.message === 'Temperatura crítica: 39.6°C',
      );

      expect(matchingAlerts).toHaveLength(1);

      await req()
        .post(`/api/alerts/${matchingAlerts[0].id}/acknowledge`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(201);

      await req()
        .put(`/api/encounters/${state.encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            signosVitales: {
              temperatura: '39.6',
            },
          },
          completed: true,
        })
        .expect(200);

      const afterRepeatRes = await req()
        .get(`/api/alerts/patient/${state.patientId}?includeAcknowledged=true`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(
        afterRepeatRes.body.filter((alert: any) => alert.message === 'Temperatura crítica: 39.6°C'),
      ).toHaveLength(1);
    });

    it('PUT /api/encounters/:id/sections/SOSPECHA_DIAGNOSTICA → rejects malformed ranked diagnoses', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/SOSPECHA_DIAGNOSTICA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            sospechas: [
              {
                diagnostico: 'Apendicitis',
                notas: 'Dolor en fosa iliaca derecha',
              },
            ],
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/TRATAMIENTO → rejects invalid structured order status', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/TRATAMIENTO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            examenesEstructurados: [
              {
                id: 'exam-invalido',
                nombre: 'Perfil bioquímico',
                estado: 'ENVIADO',
              },
            ],
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/TRATAMIENTO → store structured exam orders', async () => {
      const res = await req()
        .put(`/api/encounters/${state.encounterId}/sections/TRATAMIENTO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            plan: 'Solicitar examenes y reevaluar.',
            medicamentosEstructurados: [
              {
                id: 'med-vacio',
                nombre: '',
                dosis: '',
                frecuencia: '',
                duracion: '',
              },
            ],
            examenesEstructurados: [
              {
                id: 'exam-hemograma',
                nombre: 'Hemograma completo',
                indicacion: 'Control de anemia',
                estado: 'PENDIENTE',
              },
              {
                id: 'exam-vacio',
                nombre: '',
                indicacion: '',
                estado: 'PENDIENTE',
              },
            ],
          },
          completed: true,
        })
        .expect(200);

      expect(res.body.sectionKey).toBe('TRATAMIENTO');
      expect(res.body.completed).toBe(true);
      const storedData = res.body.data;
      expect(storedData.medicamentosEstructurados ?? []).toHaveLength(0);
      expect(storedData.examenesEstructurados ?? []).toHaveLength(1);
    });

    it('PUT /api/encounters/:id/sections/RESPUESTA_TRATAMIENTO → rejects non-text payloads', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/RESPUESTA_TRATAMIENTO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            evolucion: { texto: 'Mejoría parcial' },
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/OBSERVACIONES → rejects non-text internal notes', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/OBSERVACIONES`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            notasInternas: ['coordinar control en 48 h'],
          },
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections/ANAMNESIS_REMOTA → marks optional section as not applicable', async () => {
      const res = await req()
        .put(`/api/encounters/${state.encounterId}/sections/ANAMNESIS_REMOTA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {},
          completed: true,
          notApplicable: true,
          notApplicableReason: 'Paciente pediátrico sin antecedentes remotos relevantes',
        })
        .expect(200);

      expect(res.body.notApplicable).toBe(true);
      expect(res.body.completed).toBe(true);
      expect(res.body.notApplicableReason).toBe('Paciente pediátrico sin antecedentes remotos relevantes');
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → rejects notApplicable on required section', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: { texto: 'Cefalea intensa' },
          notApplicable: true,
        })
        .expect(400);
    });

    it('PUT /api/encounters/:id/sections → rejects notApplicable without reason', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/REVISION_SISTEMAS`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {},
          completed: true,
          notApplicable: true,
        })
        .expect(400);
    });

    it('POST /api/encounters/:id/reconcile-identification → refreshes identification from patient master', async () => {
      const res = await req()
        .post(`/api/encounters/${state.encounterId}/reconcile-identification`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(201);

      expect(res.body.sectionKey).toBe('IDENTIFICACION');
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.nombre).toBe('string');
    });

    it('POST /api/patients/:id/problems → create patient problem', async () => {
      const onsetDate = '2026-03-18';
      const res = await req()
        .post(`/api/patients/${state.patientId}/problems`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          label: 'Hipertension arterial',
          notes: 'Control pendiente',
          status: 'ACTIVO',
          onsetDate,
          encounterId: state.encounterId,
        })
        .expect(201);

      expect(res.body.label).toBe('Hipertension arterial');
      expect(res.body.onsetDate.slice(0, 10)).toBe(onsetDate);
      expect(res.body.medicoId).toBe(state.medicoUserId);
      state.patientProblemId = res.body.id;
    });

    it('PUT /api/patients/problems/:problemId → rejects invalid patient problem status', async () => {
      const res = await req()
        .put(`/api/patients/problems/${state.patientProblemId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          status: 'ESTADO_INVALIDO',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('status');
    });

    it('PUT /api/patients/problems/:problemId → resolve patient problem', async () => {
      const res = await req()
        .put(`/api/patients/problems/${state.patientProblemId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          status: 'RESUELTO',
        })
        .expect(200);

      expect(res.body.status).toBe('RESUELTO');
    });

    it('POST /api/patients/:id/tasks → create patient task', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await req()
        .post(`/api/patients/${state.patientId}/tasks`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          title: 'Revisar examen de control',
          details: 'Llamar al paciente cuando llegue resultado',
          type: 'EXAMEN',
          dueDate: today,
          encounterId: state.encounterId,
        })
        .expect(201);

      expect(res.body.title).toBe('Revisar examen de control');
      expect(res.body.dueDate.slice(0, 10)).toBe(today);
      expect(res.body.medicoId).toBe(state.medicoUserId);
      state.patientTaskId = res.body.id;
    });

    it('GET /api/patients/tasks → list task inbox', async () => {
      const res = await req()
        .get('/api/patients/tasks?search=Revisar')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.data.some((task: any) => task.id === state.patientTaskId)).toBe(true);
    });

    it('GET /api/patients/tasks → admin gets 403 because the task inbox is clinical', async () => {
      await req().get('/api/patients/tasks?search=Revisar').set('Cookie', cookieHeader(state.adminCookies)).expect(403);
    });

    it('GET /api/patients/tasks?overdueOnly=true → does not mark tasks due today as overdue', async () => {
      const res = await req()
        .get('/api/patients/tasks?overdueOnly=true')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.data.some((task: any) => task.id === state.patientTaskId)).toBe(false);
    });

    it('PUT /api/patients/tasks/:taskId → update patient task', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const res = await req()
        .put(`/api/patients/tasks/${state.patientTaskId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          title: 'Revisar examen de control actualizado',
          status: 'EN_PROCESO',
          dueDate: yesterday,
        })
        .expect(200);

      expect(res.body.title).toBe('Revisar examen de control actualizado');
      expect(res.body.status).toBe('EN_PROCESO');
      expect(res.body.dueDate.slice(0, 10)).toBe(yesterday);
    });

    it('GET /api/patients/tasks?overdueOnly=true → includes tasks whose due date already passed', async () => {
      const res = await req()
        .get('/api/patients/tasks?overdueOnly=true')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const task = res.body.data.find((item: any) => item.id === state.patientTaskId);
      expect(task).toBeDefined();
      expect(task.isOverdue).toBe(true);
    });

    it('GET /api/patients/tasks?status=COMPLETADA&overdueOnly=true → keeps filter semantics and returns empty', async () => {
      const res = await req()
        .get('/api/patients/tasks?status=COMPLETADA&overdueOnly=true')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('POST /api/attachments/encounter/:id → upload exam result linked to structured order', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const res = await req()
        .post(`/api/attachments/encounter/${state.encounterId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .field('category', 'EXAMEN')
        .field('description', 'Resultado recibido por laboratorio')
        .field('linkedOrderType', 'EXAMEN')
        .field('linkedOrderId', 'exam-hemograma')
        .attach('file', pdfBuffer, {
          filename: 'hemograma.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.originalName).toBe('hemograma.pdf');
      expect(res.body.linkedOrderType).toBe('EXAMEN');
      expect(res.body.linkedOrderId).toBe('exam-hemograma');
      expect(res.body.linkedOrderLabel).toBe('Hemograma completo');
      state.attachmentId = res.body.id;
    });

    it('GET /api/attachments/encounter/:id → returns linked attachment metadata', async () => {
      const res = await req()
        .get(`/api/attachments/encounter/${state.encounterId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const attachment = res.body.find((item: any) => item.id === state.attachmentId);
      expect(attachment).toBeDefined();
      expect(attachment.linkedOrderType).toBe('EXAMEN');
      expect(attachment.linkedOrderLabel).toBe('Hemograma completo');
    });

    it('GET /api/attachments/:id/download → returns binary file', async () => {
      const res = await req()
        .get(`/api/attachments/${state.attachmentId}/download`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('hemograma.pdf');
    });

    it('PUT /api/encounters/:id/review-status → rejects review without contextual note', async () => {
      const res = await req()
        .put(`/api/encounters/${state.encounterId}/review-status`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          reviewStatus: 'REVISADA_POR_MEDICO',
          note: 'corta',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('nota de revisión');
    });

    it('PUT /api/encounters/:id/review-status → update review status with note and traceability', async () => {
      const res = await req()
        .put(`/api/encounters/${state.encounterId}/review-status`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          reviewStatus: 'REVISADA_POR_MEDICO',
          note: 'Revisión médica realizada con correlación clínico-radiológica.',
        })
        .expect(200);

      expect(res.body.reviewStatus).toBe('REVISADA_POR_MEDICO');
      expect(res.body.reviewNote).toContain('Revisión médica');
      expect(res.body.reviewedBy?.id).toBe(state.medicoUserId);
    });

    it('GET /api/patients/:id → returns patient detail without embedding the encounter timeline', async () => {
      const res = await req().get(`/api/patients/${state.patientId}`).set('Cookie', cookieHeader(state.medicoCookies)).expect(200);

      expect(res.body.encounters).toBeUndefined();
    });

    it('GET /api/patients/:id/encounters → returns a paginated timeline read model with schemaVersion', async () => {
      const res = await req()
        .get(`/api/patients/${state.patientId}/encounters?page=1&limit=5`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const encounter = res.body.data.find((item: any) => item.id === state.encounterId);
      expect(encounter).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination?.page).toBe(1);
      expect(res.body.pagination?.limit).toBe(5);
      expect(res.body.pagination?.total).toBeGreaterThanOrEqual(1);
      expect(encounter.progress?.total).toBe(10);
      expect(encounter.reviewNote).toContain('Revisión médica');
      expect(encounter.reviewedBy?.id).toBe(state.medicoUserId);
      expect(Array.isArray(encounter.sections)).toBe(true);
      expect(
        encounter.sections.every(
          (section: any) => section.schemaVersion === getEncounterSectionSchemaVersion(section.sectionKey),
        ),
      ).toBe(true);
    });

    it('GET /api/patients/:id/clinical-summary → returns a derived longitudinal read model', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            signosVitales: {
              presionArterial: '120/80',
              peso: '70',
              imc: '24.2',
              temperatura: '36.7',
              saturacionOxigeno: '98',
            },
          },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${state.encounterId}/sections/SOSPECHA_DIAGNOSTICA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            sospechas: [{ id: 'dx-1', diagnostico: 'Migraña', notas: 'probable' }],
          },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${state.encounterId}/sections/OBSERVACIONES`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            resumenClinico: 'Paciente con buena respuesta inicial.',
          },
        })
        .expect(200);

      const res = await req()
        .get(`/api/patients/${state.patientId}/clinical-summary`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.patientId).toBe(state.patientId);
      expect(res.body.counts.totalEncounters).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.vitalTrend)).toBe(true);
      expect(res.body.vitalTrend[0]?.peso).toBe(70);
      expect(res.body.recentDiagnoses).toEqual(
        expect.arrayContaining([expect.objectContaining({ label: 'Migraña', count: 1 })]),
      );
      expect(res.body.latestEncounterSummary?.lines).toEqual(
        expect.arrayContaining([expect.stringContaining('Resumen: Paciente con buena respuesta inicial.')]),
      );
    });

    it('GET /api/encounters?reviewStatus=REVISADA_POR_MEDICO → filter encounters by review status', async () => {
      const res = await req()
        .get('/api/encounters?reviewStatus=REVISADA_POR_MEDICO')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.data.some((item: any) => item.id === state.encounterId)).toBe(true);
    });

    it('POST /api/patients/quick → create blocked patient for output-policy coverage', async () => {
      const res = await req()
        .post('/api/patients/quick')
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({
          nombre: 'Paciente Bloqueado',
          rutExempt: true,
          rutExemptReason: 'Paciente sin documento disponible',
        })
        .expect(201);

      state.blockedPatientId = res.body.id;
      expect(res.body.completenessStatus).toBe('INCOMPLETA');
    });

    it('POST /api/encounters/patient/:patientId → create encounter for output-policy coverage', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${state.blockedPatientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({})
        .expect(201);

      state.blockedEncounterId = res.body.id;
      expect(state.blockedEncounterId).toBeDefined();
    });

    it('POST /api/consents → 400 when encounterId does not belong to patientId', async () => {
      const res = await req()
        .post('/api/consents')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          patientId: state.patientId,
          encounterId: state.blockedEncounterId,
          type: 'TRATAMIENTO',
          description: 'Consentimiento inválido para validar asociación paciente-atención.',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('no corresponde al paciente');
    });

    it('POST /api/alerts → 400 when encounterId does not belong to patientId', async () => {
      const res = await req()
        .post('/api/alerts')
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          patientId: state.patientId,
          encounterId: state.blockedEncounterId,
          type: 'GENERAL',
          severity: 'MEDIA',
          title: 'Asociación inválida',
          message: 'La atención no corresponde al paciente indicado.',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('no corresponde al paciente');
    });

    it('GET /api/encounters/:id/export/pdf → 400 while patient record remains incomplete', async () => {
      const res = await req()
        .get(`/api/encounters/${state.blockedEncounterId}/export/pdf`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(400);

      expect(String(res.body.message)).toContain('ficha maestra del paciente sigue incompleta');
    });

    it('POST /api/encounters/:id/complete → 400 while patient record remains incomplete', async () => {
      const res = await req()
        .post(`/api/encounters/${state.blockedEncounterId}/complete`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ closureNote: 'Cierre suficientemente largo para la validación base.' })
        .expect(400);

      expect(String(res.body.message)).toContain('ficha maestra del paciente sigue incompleta');
    });

    it('PUT /api/patients/:id/admin → move blocked patient to pending verification', async () => {
      const res = await req()
        .put(`/api/patients/${state.blockedPatientId}/admin`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send({
          edad: 31,
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          trabajo: 'Recepcionista',
        })
        .expect(200);

      expect(res.body.completenessStatus).toBe('PENDIENTE_VERIFICACION');
    });

    it('GET /api/encounters/:id/export/document/receta → 400 while patient record is pending verification', async () => {
      const res = await req()
        .get(`/api/encounters/${state.blockedEncounterId}/export/document/receta`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(400);

      expect(String(res.body.message)).toContain('pendiente de verificación médica');
    });

    it('GET /api/encounters/:id/export/document/receta → returns PDF', async () => {
      const res = await req()
        .get(`/api/encounters/${state.encounterId}/export/document/receta`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('GET /api/encounters/:id/export/document/ordenes → returns PDF', async () => {
      const res = await req()
        .get(`/api/encounters/${state.encounterId}/export/document/ordenes`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('GET /api/encounters/:id/export/document/derivacion → returns PDF', async () => {
      const res = await req()
        .get(`/api/encounters/${state.encounterId}/export/document/derivacion`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('DELETE /api/attachments/:id → medico can delete attachment', async () => {
      const res = await req()
        .delete(`/api/attachments/${state.attachmentId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      expect(res.body.message).toContain('papelera');
    });

    it('POST /api/encounters/:id/complete → 400 when required sections are missing', async () => {
      const res = await req()
        .post(`/api/encounters/${state.encounterId}/complete`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(400);

      expect(String(res.body.message)).toContain('secciones obligatorias');
    });

    it('PUT /api/encounters/:id/sections/INVALID → 400', async () => {
      await req()
        .put(`/api/encounters/${state.encounterId}/sections/INVALID_KEY`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({ data: { foo: 'bar' } })
        .expect(400);
    });

    it('POST /api/encounters/:id/cancel → cancel encounter', async () => {
      const res = await req()
        .post(`/api/encounters/${state.encounterId}/cancel`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(201);

      expect(res.body.status).toBe('CANCELADO');
    });

    it('POST /api/encounters/patient/:patientId → create workflow encounter for complete/reopen coverage', async () => {
      const res = await req()
        .post(`/api/encounters/patient/${state.patientId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({})
        .expect(201);

      state.workflowEncounterId = res.body.id;
      expect(state.workflowEncounterId).toBeDefined();
    });

    it('PUT /api/encounters/:id/sections/IDENTIFICACION → marks identification snapshot complete for workflow encounter', async () => {
      const encounterRes = await req()
        .get(`/api/encounters/${state.workflowEncounterId}`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .expect(200);

      const identification = encounterRes.body.sections.find((section: any) => section.sectionKey === 'IDENTIFICACION');

      const res = await req()
        .put(`/api/encounters/${state.workflowEncounterId}/sections/IDENTIFICACION`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: identification.data,
          completed: true,
        })
        .expect(200);

      expect(res.body.completed).toBe(true);
    });

    it('PUT /api/encounters/:id/sections/MOTIVO_CONSULTA → prepares workflow encounter for completion', async () => {
      await req()
        .put(`/api/encounters/${state.workflowEncounterId}/sections/MOTIVO_CONSULTA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: { texto: 'Dolor abdominal de 24 horas de evolución' },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${state.workflowEncounterId}/sections/EXAMEN_FISICO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            abdomen: 'Abdomen blando, depresible, doloroso en fosa iliaca derecha.',
          },
          completed: true,
        })
        .expect(200);

      await req()
        .put(`/api/encounters/${state.workflowEncounterId}/sections/SOSPECHA_DIAGNOSTICA`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            sospechas: [
              {
                id: 'dx-apendicitis',
                diagnostico: 'Apendicitis aguda',
                notas: 'Correlacionar con clínica y exámenes.',
              },
            ],
          },
          completed: true,
        })
        .expect(200);

      const treatmentRes = await req()
        .put(`/api/encounters/${state.workflowEncounterId}/sections/TRATAMIENTO`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          data: {
            plan: 'Solicitar evaluación quirúrgica y laboratorio urgente.',
          },
          completed: true,
        })
        .expect(200);

      expect(treatmentRes.body.completed).toBe(true);
    });

    it('POST /api/encounters/:id/complete → rejects completion without closure note once sections are ready', async () => {
      const res = await req()
        .post(`/api/encounters/${state.workflowEncounterId}/complete`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          closureNote: 'corta',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('nota de cierre');
    });

    it('PUT /api/encounters/:id/review-status → stores workflow review note before completion', async () => {
      const res = await req()
        .put(`/api/encounters/${state.workflowEncounterId}/review-status`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          reviewStatus: 'REVISADA_POR_MEDICO',
          note: 'Revisión final con hallazgos concordantes y autorización de cierre.',
        })
        .expect(200);

      expect(res.body.reviewStatus).toBe('REVISADA_POR_MEDICO');
      expect(res.body.reviewNote).toContain('autorización de cierre');
    });

    it('POST /api/encounters/:id/complete → completes encounter with closure traceability', async () => {
      const res = await req()
        .post(`/api/encounters/${state.workflowEncounterId}/complete`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          closureNote: 'Paciente derivado con sospecha confirmada y plan quirúrgico informado.',
        })
        .expect(201);

      expect(res.body.status).toBe('COMPLETADO');
      expect(res.body.reviewStatus).toBe('REVISADA_POR_MEDICO');
      expect(res.body.reviewNote).toContain('autorización de cierre');
      expect(res.body.closureNote).toContain('plan quirúrgico');
      expect(res.body.completedBy?.id).toBe(state.medicoUserId);
    });

    it('POST /api/encounters/:id/complete → rejects double-complete on already completed encounter', async () => {
      await req()
        .post(`/api/encounters/${state.workflowEncounterId}/complete`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          closureNote: 'Intento duplicado de cierre.',
        })
        .expect(400);
    });

    it('POST /api/encounters/:id/reopen → admin gets 403 because reopening is clinical', async () => {
      await req()
        .post(`/api/encounters/${state.workflowEncounterId}/reopen`)
        .set('Cookie', cookieHeader(state.adminCookies))
        .send({
          note: 'Se intenta reabrir sin rol clínico.',
        })
        .expect(403);
    });

    it('POST /api/encounters/:id/reopen → medico requires reopen note', async () => {
      const res = await req()
        .post(`/api/encounters/${state.workflowEncounterId}/reopen`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          note: 'corta',
        })
        .expect(400);

      expect(String(res.body.message)).toContain('note');
    });

    it('POST /api/encounters/:id/reopen → medico reopens own encounter with explicit trace note', async () => {
      const res = await req()
        .post(`/api/encounters/${state.workflowEncounterId}/reopen`)
        .set('Cookie', cookieHeader(state.medicoCookies))
        .send({
          note: 'Se reabre por auditoría clínica para complementar evolución.',
        })
        .expect(201);

      expect(res.body.status).toBe('EN_PROGRESO');
      expect(res.body.reviewStatus).toBe('NO_REQUIERE_REVISION');
      expect(res.body.closureNote).toBeNull();
      expect(res.body.completedAt).toBeNull();
    });
  });
}
