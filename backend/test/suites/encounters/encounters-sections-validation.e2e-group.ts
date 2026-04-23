/// <reference types="jest" />

import { state, req, cookieHeader } from '../../helpers/e2e-setup';

export function registerEncounterSectionValidationTests() {
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
}
