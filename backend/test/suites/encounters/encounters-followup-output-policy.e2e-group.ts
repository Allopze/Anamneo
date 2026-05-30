/// <reference types="jest" />

import { state, req, cookieHeader } from '../../helpers/e2e-setup';
import { MEDICO_ONLY_SECTION_KEYS, parseBinaryResponse } from './encounters-followup.helpers';

/**
 * Output-policy, section-access, and document-export tests.
 * Runs after encounters-followup-export-review.e2e-group.ts; depends on its state.
 */
export function registerEncounterFollowupOutputPolicyTests() {
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
        fechaNacimiento: '1994-03-18',
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

  it('POST /api/encounters/:id/complete → 400 when the closure note is still missing', async () => {
    const res = await req()
      .post(`/api/encounters/${state.encounterId}/complete`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .expect(400);

    expect(String(res.body.message)).toContain('nota de cierre');
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
