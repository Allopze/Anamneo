export const ANALYTICS_DIAGNOSIS_LABEL = 'Analitica E2E Dolor Abdominal';
export const ANALYTICS_MEDICATION_LABEL = 'Paracetamol Analitica E2E';

import * as bcrypt from 'bcrypt';
import { cookieHeader, extractCookies, prisma, req, state } from '../helpers/e2e-setup';

export async function markIdentificationSectionComplete(encounterId: string) {
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

export async function createCompletedAnalyticsEncounter() {
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

