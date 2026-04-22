/// <reference types="jest" />

import { state, alertsService, req, cookieHeader } from '../../helpers/e2e-setup';
import { getEncounterSectionSchemaVersion } from '../../../src/common/utils/encounter-section-meta';

export function registerEncounterSectionCoreTests() {
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

  it('PUT /api/encounters/:id/sections/EXAMEN_FISICO → recreates acknowledged auto-alerts for the same critical value', async () => {
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

    const repeatedAlerts = afterRepeatRes.body.filter((alert: any) => alert.message === 'Temperatura crítica: 39.6°C');
    expect(repeatedAlerts).toHaveLength(2);
    expect(repeatedAlerts.some((alert: any) => alert.acknowledgedAt === null)).toBe(true);
  });


}
