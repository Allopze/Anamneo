/// <reference types="jest" />

import { state, req, cookieHeader, getApp } from '../../helpers/e2e-setup';
import { MEDICO_ONLY_SECTION_KEYS, parseBinaryResponse } from './encounters-followup.helpers';
import { getEncounterSectionSchemaVersion } from '../../../src/common/utils/encounter-section-meta';
import { PatientsExportBundleService } from '../../../src/patients/patients-export-bundle.service';

export function registerEncounterFollowupExportReviewTests() {
  it('POST /api/consents → creates a patient consent linked to the active encounter', async () => {
    const res = await req()
      .post('/api/consents')
      .set('Cookie', cookieHeader(state.medicoCookies))
      .send({
        patientId: state.patientId,
        encounterId: state.encounterId,
        type: 'TRATAMIENTO',
        description: 'Consentimiento exportable para paquete clínico.',
      })
      .expect(201);

    expect(res.body.patientId).toBe(state.patientId);
    expect(res.body.encounterId).toBe(state.encounterId);
    expect(res.body.status).toBe('ACTIVO');
  });

  it('PatientsExportBundleService → builds the integrated patient clinical package', async () => {
    const bundleService = getApp().get(PatientsExportBundleService);
    const bundle = await bundleService.generateBundle(state.patientId, {
      id: state.medicoUserId,
      role: 'MEDICO',
      email: 'medico@example.com',
      nombre: 'Dr. Medico',
      isAdmin: false,
      medicoId: state.medicoUserId,
    });

    expect(Buffer.isBuffer(bundle.buffer)).toBe(true);
    expect(bundle.buffer.length).toBeGreaterThan(200);
  });

  it('GET /api/patients/:id/export/bundle → returns a zip with the patient clinical package', async () => {
    const res = await req()
      .get(`/api/patients/${state.patientId}/export/bundle`)
      .set('Cookie', cookieHeader(state.medicoCookies))
      .buffer(true)
      .parse(parseBinaryResponse)
      .expect(200);

    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('.zip');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(200);
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
}
