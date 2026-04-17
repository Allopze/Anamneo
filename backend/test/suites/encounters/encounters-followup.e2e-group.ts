/// <reference types="jest" />

import { state, req, cookieHeader } from '../../helpers/e2e-setup';
import { getEncounterSectionSchemaVersion } from '../../../src/common/utils/encounter-section-meta';

const MEDICO_ONLY_SECTION_KEYS = ['SOSPECHA_DIAGNOSTICA', 'TRATAMIENTO', 'RESPUESTA_TRATAMIENTO'] as const;

export function registerEncounterFollowupTests() {
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
    // Use a date safely in the past to avoid UTC/local boundary flakes around midnight.
    const overdueDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await req()
      .put(`/api/patients/tasks/${state.patientTaskId}`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        title: 'Revisar examen de control actualizado',
        status: 'EN_PROCESO',
        dueDate: overdueDate,
      })
      .expect(200);

    expect(res.body.title).toBe('Revisar examen de control actualizado');
    expect(res.body.status).toBe('EN_PROCESO');
    expect(res.body.dueDate.slice(0, 10)).toBe(overdueDate);
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

  it('POST /api/encounters/patient/:patientId → assistant can create an encounter but does not receive medico-only sections', async () => {
    const res = await req()
      .post(`/api/encounters/patient/${state.quickPatientId}`)
      .set('Cookie', cookieHeader(state.assistantCookies))
      .send({})
      .expect(201);

    state.assistantEncounterId = res.body.id;
    expect(res.body.id).toBeDefined();
    const sectionKeys = res.body.sections.map((section: any) => section.sectionKey);
    for (const sectionKey of MEDICO_ONLY_SECTION_KEYS) {
      expect(sectionKeys).not.toContain(sectionKey);
    }
  });

  it('GET /api/encounters/:id → assistant does not receive medico-only sections', async () => {
    const res = await req()
      .get(`/api/encounters/${state.assistantEncounterId}`)
      .set('Cookie', cookieHeader(state.assistantCookies))
      .expect(200);

    const sectionKeys = res.body.sections.map((section: any) => section.sectionKey);
    for (const sectionKey of MEDICO_ONLY_SECTION_KEYS) {
      expect(sectionKeys).not.toContain(sectionKey);
    }
  });

  it.each(MEDICO_ONLY_SECTION_KEYS)(
    'PUT /api/encounters/:id/sections/%s → assistant gets 403 on medico-only section',
    async (sectionKey) => {
      const payloadBySection = {
        SOSPECHA_DIAGNOSTICA: {
          data: {
            sospechas: [
              {
                id: 'dx-hta',
                diagnostico: 'Hipertensión arterial',
                prioridad: 1,
                notas: 'No debería permitir edición por asistente.',
              },
            ],
          },
          completed: true,
        },
        TRATAMIENTO: {
          data: {
            indicaciones: 'No debería permitir plan terapéutico por asistente.',
          },
          completed: true,
        },
        RESPUESTA_TRATAMIENTO: {
          data: {
            respuesta: 'No debería permitir registrar evolución terapéutica por asistente.',
          },
          completed: true,
        },
      } as const;

      await req()
        .put(`/api/encounters/${state.assistantEncounterId}/sections/${sectionKey}`)
        .set('Cookie', cookieHeader(state.assistantCookies))
        .send(payloadBySection[sectionKey])
        .expect(403);
    },
  );

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
}
