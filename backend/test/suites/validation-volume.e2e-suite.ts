import { state, prisma, req, cookieHeader } from '../helpers/e2e-setup';
import {
  ENCOUNTER_SECTION_ORDER,
  getEncounterSectionSchemaVersion,
} from '../../src/common/utils/encounter-section-meta';

export function validationVolumeSuite() {
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
