import {
  getSectionData,
  buildEncounterSummary,
  extractStructuredMedicationLines,
  extractStructuredOrderLines,
  extractVitalTrend,
  formatHistoryFieldText,
  getRevisionSystemEntries,
  getTreatmentPlanText,
} from '@/lib/clinical';
import { Encounter, StructuredMedication, StructuredOrder } from '@/types';

function makeEncounter(sections: Array<{ sectionKey: string; data: any }>): Encounter {
  return {
    id: 'enc-1',
    createdAt: '2026-01-01T00:00:00Z',
    sections: sections.map((s) => ({ ...s, id: 's1' })),
  } as unknown as Encounter;
}

describe('getSectionData', () => {
  it('returns data for matching section', () => {
    const enc = makeEncounter([{ sectionKey: 'MOTIVO_CONSULTA', data: { texto: 'dolor' } }]);
    expect(getSectionData(enc, 'MOTIVO_CONSULTA')).toEqual({ texto: 'dolor' });
  });

  it('returns empty object when section not found', () => {
    const enc = makeEncounter([]);
    expect(getSectionData(enc, 'MOTIVO_CONSULTA')).toEqual({});
  });

  it('returns empty object for undefined encounter', () => {
    expect(getSectionData(undefined, 'MOTIVO_CONSULTA')).toEqual({});
  });
});

describe('buildEncounterSummary', () => {
  it('builds summary from motivo and diagnostico', () => {
    const enc = makeEncounter([
      { sectionKey: 'MOTIVO_CONSULTA', data: { texto: 'Cefalea intensa' } },
      {
        sectionKey: 'SOSPECHA_DIAGNOSTICA',
        data: { sospechas: [{ diagnostico: 'Migraña' }] },
      },
      { sectionKey: 'TRATAMIENTO', data: { plan: 'Reposo y analgésicos' } },
    ]);

    const lines = buildEncounterSummary(enc);
    expect(lines).toContain('Cefalea intensa');
    expect(lines).toEqual(
      expect.arrayContaining([expect.stringContaining('Migraña')])
    );
    expect(lines).toEqual(
      expect.arrayContaining([expect.stringContaining('Reposo')])
    );
  });

  it('returns empty array when no data', () => {
    const enc = makeEncounter([]);
    expect(buildEncounterSummary(enc)).toEqual([]);
  });

  it('limits to 4 lines', () => {
    const enc = makeEncounter([
      { sectionKey: 'MOTIVO_CONSULTA', data: { texto: 'Motivo' } },
      {
        sectionKey: 'SOSPECHA_DIAGNOSTICA',
        data: { sospechas: [{ diagnostico: 'Dx1' }] },
      },
      { sectionKey: 'TRATAMIENTO', data: { plan: 'Plan' } },
      {
        sectionKey: 'RESPUESTA_TRATAMIENTO',
        data: { planSeguimiento: 'Control en 7d' },
      },
    ]);
    expect(buildEncounterSummary(enc).length).toBeLessThanOrEqual(4);
  });

  it('uses indicaciones when the legacy treatment field is the only one present', () => {
    const enc = makeEncounter([
      { sectionKey: 'TRATAMIENTO', data: { indicaciones: 'Control y reposo' } },
    ]);

    expect(buildEncounterSummary(enc)).toEqual(
      expect.arrayContaining([expect.stringContaining('Control y reposo')]),
    );
  });
});

describe('extractStructuredMedicationLines', () => {
  it('formats medication lines', () => {
    const meds: StructuredMedication[] = [
      {
        id: 'med-1',
        nombre: 'Paracetamol',
        dosis: '500mg',
        frecuencia: 'c/8h',
        duracion: '5 días',
      },
    ];
    const lines = extractStructuredMedicationLines(meds);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Paracetamol');
    expect(lines[0]).toContain('500mg');
    expect(lines[0]).toContain('c/8h');
  });

  it('handles undefined', () => {
    expect(extractStructuredMedicationLines(undefined)).toEqual([]);
  });

  it('skips empty fields', () => {
    const meds: StructuredMedication[] = [
      { id: 'med-2', nombre: 'Ibuprofeno', dosis: '', frecuencia: '', duracion: '' },
    ];
    const lines = extractStructuredMedicationLines(meds);
    expect(lines[0]).toBe('Ibuprofeno');
  });
});

describe('extractStructuredOrderLines', () => {
  it('formats order lines', () => {
    const orders: StructuredOrder[] = [
      { id: 'ord-1', nombre: 'Hemograma', estado: 'PENDIENTE', indicacion: 'Control' },
    ];
    const lines = extractStructuredOrderLines(orders);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Hemograma');
    expect(lines[0]).toContain('PENDIENTE');
  });

  it('handles undefined', () => {
    expect(extractStructuredOrderLines(undefined)).toEqual([]);
  });
});

describe('extractVitalTrend', () => {
  it('extracts vital signs from encounters', () => {
    const encounters = [
      makeEncounter([
        {
          sectionKey: 'EXAMEN_FISICO',
          data: {
            signosVitales: {
              presionArterial: '120/80',
              peso: '70',
              temperatura: '36.5',
              saturacionOxigeno: '98',
              imc: '24.2',
            },
          },
        },
      ]),
    ];

    const trend = extractVitalTrend(encounters);
    expect(trend).toHaveLength(1);
    expect(trend[0].presionArterial).toBe('120/80');
    expect(trend[0].peso).toBe(70);
    expect(trend[0].temperatura).toBe(36.5);
  });

  it('skips encounters without vital signs', () => {
    const encounters = [
      makeEncounter([{ sectionKey: 'EXAMEN_FISICO', data: {} }]),
    ];
    expect(extractVitalTrend(encounters)).toHaveLength(0);
  });

  it('handles undefined encounters', () => {
    expect(extractVitalTrend(undefined)).toEqual([]);
  });
});

describe('getTreatmentPlanText', () => {
  it('returns the shared treatment text when plan and indicaciones match', () => {
    expect(getTreatmentPlanText({ plan: 'Reposo', indicaciones: 'Reposo' })).toBe('Reposo');
  });

  it('merges plan and additional instructions when both are different', () => {
    expect(getTreatmentPlanText({ plan: 'Reposo', indicaciones: 'Control en 48 h' })).toContain(
      'Indicaciones adicionales',
    );
  });
});

describe('formatHistoryFieldText', () => {
  it('combines history chips with free text', () => {
    expect(
      formatHistoryFieldText({
        items: ['HTA'],
        texto: 'En tratamiento.',
      }),
    ).toBe('HTA. En tratamiento.');
  });
});

describe('getRevisionSystemEntries', () => {
  it('formats checked systems with notes', () => {
    expect(
      getRevisionSystemEntries({
        respiratorio: {
          checked: true,
          notas: 'Tos seca',
        },
      }),
    ).toEqual([
      {
        key: 'respiratorio',
        label: 'Respiratorio',
        text: 'Tos seca',
      },
    ]);
  });

  it('returns an explicit negative summary when the review is negative', () => {
    expect(
      getRevisionSystemEntries({
        negativa: true,
      }),
    ).toEqual([
      {
        key: 'negativa',
        label: 'Resultado',
        text: 'Negativa, nada que reportar',
      },
    ]);
  });
});
