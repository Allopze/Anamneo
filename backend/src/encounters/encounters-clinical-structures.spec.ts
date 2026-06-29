import { syncEncounterClinicalStructures } from './encounters-clinical-structures';
import { reconcileEncounterEpisode } from './encounters-episodes';

jest.mock('./encounters-episodes', () => ({
  reconcileEncounterEpisode: jest.fn().mockResolvedValue(null),
}));

describe('syncEncounterClinicalStructures', () => {
  it('links each treatment to the explicitly selected diagnostic suspicion when multiple diagnoses exist', async () => {
    const createdDiagnoses: Array<{ id: string; normalizedLabel: string }> = [];
    const createdTreatments: Array<{ id: string; diagnosisId?: string | null; label: string }> = [];
    const createdOutcomes: Array<{
      encounterTreatmentId: string;
      outcomeStatus: string;
      notes?: string | null;
      adherenceStatus?: string | null;
      adverseEventSeverity?: string | null;
      adverseEventNotes?: string | null;
    }> = [];

    const prisma = {
      encounter: {
        findUnique: jest.fn().mockResolvedValue({
          patientId: 'patient-1',
          createdAt: new Date('2026-04-21T14:00:00.000Z'),
        }),
      },
      encounterSection: {
        findMany: jest.fn().mockResolvedValue([
          {
            encounterId: 'enc-1',
            sectionKey: 'SOSPECHA_DIAGNOSTICA',
            data: JSON.stringify({
              sospechas: [
                { id: 'dx-a', diagnostico: 'Gastritis aguda', prioridad: 1 },
                { id: 'dx-b', diagnostico: 'Colecistitis', prioridad: 2 },
              ],
            }),
          },
          {
            encounterId: 'enc-1',
            sectionKey: 'TRATAMIENTO',
            data: JSON.stringify({
              medicamentosEstructurados: [
                { id: 'med-1', nombre: 'Omeprazol', sospechaId: 'dx-a' },
              ],
              examenesEstructurados: [
                { id: 'exam-1', nombre: 'Ecografía abdominal', estado: 'PENDIENTE', sospechaId: 'dx-b' },
              ],
            }),
          },
          {
            encounterId: 'enc-1',
            sectionKey: 'RESPUESTA_TRATAMIENTO',
            data: JSON.stringify({
              respuestaEstructurada: { estado: 'PARCIAL' },
              resultadosTratamientos: [
                {
                  treatmentItemId: 'med-1',
                  estado: 'FAVORABLE',
                  notas: 'Cede el dolor',
                  adherenceStatus: 'ADHERENTE',
                },
                { treatmentItemId: 'exam-1', estado: 'PARCIAL', notas: 'Pendiente correlación' },
              ],
            }),
          },
        ]),
      },
      encounterTreatmentOutcome: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockImplementation(({ data }) => {
          createdOutcomes.push(data);
          return Promise.resolve({ id: `out-${data.encounterTreatmentId}`, ...data });
        }),
      },
      encounterTreatment: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = {
            id: `treat-${createdTreatments.length + 1}`,
            diagnosisId: data.diagnosisId ?? null,
            label: data.label,
          };
          createdTreatments.push(created);
          return Promise.resolve(created);
        }),
      },
      encounterDiagnosis: {
        deleteMany: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockImplementation(({ data }) => {
          const created = {
            id: `diag-${createdDiagnoses.length + 1}`,
            normalizedLabel: data.normalizedLabel,
          };
          createdDiagnoses.push(created);
          return Promise.resolve(created);
        }),
      },
    } as any;

    await syncEncounterClinicalStructures({
      prisma,
      encounterId: 'enc-1',
    });

    expect(createdTreatments).toEqual([
      expect.objectContaining({ label: 'Omeprazol', diagnosisId: 'diag-1' }),
      expect.objectContaining({ label: 'Ecografía abdominal', diagnosisId: 'diag-2' }),
    ]);
    expect(createdOutcomes).toEqual([
      expect.objectContaining({
        encounterTreatmentId: 'treat-1',
        outcomeStatus: 'FAVORABLE',
        notes: 'Cede el dolor',
        adherenceStatus: 'ADHERENTE',
      }),
      expect.objectContaining({ encounterTreatmentId: 'treat-2', outcomeStatus: 'PARCIAL', notes: 'Pendiente correlación' }),
    ]);
    expect(reconcileEncounterEpisode).toHaveBeenCalled();
  });
});