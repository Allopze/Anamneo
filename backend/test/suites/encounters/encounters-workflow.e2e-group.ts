/// <reference types="jest" />

import { state, req, cookieHeader } from '../../helpers/e2e-setup';

export function registerEncounterWorkflowTests() {
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

  it('POST /api/encounters/:id/complete → treating doctor can complete an encounter created by an assistant', async () => {
    const assistantEncounterRes = await req()
      .get(`/api/encounters/${state.assistantEncounterId}`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(200);

    const identification = assistantEncounterRes.body.sections.find((section: any) => section.sectionKey === 'IDENTIFICACION');

    await req()
      .put(`/api/encounters/${state.assistantEncounterId}/sections/IDENTIFICACION`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        data: identification.data,
        completed: true,
      })
      .expect(200);

    await req()
      .put(`/api/encounters/${state.assistantEncounterId}/sections/MOTIVO_CONSULTA`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        data: { texto: 'Control evolutivo posterior a evaluación inicial realizada por recepción.' },
        completed: true,
      })
      .expect(200);

    await req()
      .put(`/api/encounters/${state.assistantEncounterId}/sections/EXAMEN_FISICO`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        data: {
          signosVitales: {
            presionArterial: '120/80',
            temperatura: '36.6',
          },
          estadoGeneral: 'Paciente en buenas condiciones generales.',
        },
        completed: true,
      })
      .expect(200);

    await req()
      .put(`/api/encounters/${state.assistantEncounterId}/sections/SOSPECHA_DIAGNOSTICA`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        data: {
          sospechas: [
            {
              id: 'dx-control',
              diagnostico: 'Control clínico sin hallazgos de alarma',
              notas: 'Evolución favorable al momento del cierre.',
            },
          ],
        },
        completed: true,
      })
      .expect(200);

    await req()
      .put(`/api/encounters/${state.assistantEncounterId}/sections/TRATAMIENTO`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        data: {
          plan: 'Mantener indicaciones previas y control ambulatorio según evolución.',
        },
        completed: true,
      })
      .expect(200);

    const completeRes = await req()
      .post(`/api/encounters/${state.assistantEncounterId}/complete`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        closureNote: 'Médico tratante revisa la atención preparada por asistente y la completa sin rehacer el encuentro.',
      })
      .expect(201);

    expect(completeRes.body.status).toBe('COMPLETADO');
    expect(completeRes.body.createdBy?.id).toBe(state.assistantUserId);
    expect(completeRes.body.completedBy?.id).toBe(state.medicoUserId);
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
}
