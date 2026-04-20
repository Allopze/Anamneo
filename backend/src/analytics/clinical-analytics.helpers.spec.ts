import { buildClinicalAnalyticsEncounter, getEncounterConditions, matchesAnalyticsCondition, matchesAnalyticsQuery } from './clinical-analytics.helpers';

describe('clinical-analytics.helpers', () => {
  it('extracts conditions, symptoms, food association and response proxies from encounter sections', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-1',
      patientId: 'pat-1',
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      patient: {
        id: 'pat-1',
        edad: 42,
        sexo: 'F',
        prevision: 'FONASA',
      },
      sections: [
        {
          sectionKey: 'MOTIVO_CONSULTA',
          data: {
            texto: 'Consulta por dolor abdominal postprandial',
            afeccionSeleccionada: { id: 'cond-1', name: 'Hipertensión arterial', confidence: 92 },
          },
        },
        {
          sectionKey: 'ANAMNESIS_PROXIMA',
          data: {
            relatoAmpliado: 'Refiere dolor abdominal con vómitos y diarrea después de comer',
            factoresAgravantes: 'Empeora tras comidas copiosas',
            sintomasAsociados: 'Vomitos y diarrea',
            perfilDolorAbdominal: {
              presente: true,
              vomitos: true,
              diarrea: true,
              asociadoComida: 'SI',
              notas: 'Dolor tipo cólico postprandial',
            },
          },
        },
        {
          sectionKey: 'REVISION_SISTEMAS',
          data: { gastrointestinal: { checked: true, notas: 'Diarrea y dolor abdominal.' } },
        },
        {
          sectionKey: 'SOSPECHA_DIAGNOSTICA',
          data: { sospechas: [{ id: 'dx-1', diagnostico: 'Hipertensión esencial', codigoCie10: 'I10' }] },
        },
        {
          sectionKey: 'TRATAMIENTO',
          data: {
            medicamentosEstructurados: [{ id: 'med-1', nombre: 'Enalapril', dosis: '10 mg', via: 'ORAL', frecuencia: 'cada 24 h' }],
            examenesEstructurados: [{ id: 'exam-1', nombre: 'Perfil lipídico', estado: 'PENDIENTE' }],
          },
        },
        {
          sectionKey: 'RESPUESTA_TRATAMIENTO',
          data: {
            respuestaEstructurada: { estado: 'FAVORABLE', notas: 'Tolera alimentación y cede dolor' },
            evolucion: 'Buena respuesta, sin dolor desde el segundo día',
            ajustesTratamiento: 'Aumentar dosis si persiste elevación',
            planSeguimiento: 'Control en 2 semanas',
          },
        },
      ],
    });

    expect(encounter.probableConditions).toHaveLength(1);
    expect(encounter.diagnosticConditions).toHaveLength(1);
    expect(encounter.medications[0].label).toBe('Enalapril');
    expect(encounter.exams[0].label).toBe('Perfil lipídico');
    expect(encounter.symptomSignals.map((entry) => entry.label)).toEqual(expect.arrayContaining(['Dolor abdominal', 'Vómitos', 'Diarrea']));
    expect(encounter.foodRelation).toBe('ASSOCIATED');
    expect(encounter.hasStructuredTreatment).toBe(true);
    expect(encounter.hasTreatmentAdjustment).toBe(true);
    expect(encounter.hasFollowUpPlan).toBe(true);
    expect(encounter.hasFavorableResponse).toBe(true);
  });

  it('recognizes structured abdominal profile and structured response without relying on free text', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-2',
      patientId: 'pat-2',
      createdAt: new Date('2026-04-03T12:00:00.000Z'),
      patient: {
        id: 'pat-2',
        edad: 35,
        sexo: 'M',
        prevision: 'ISAPRE',
      },
      sections: [
        {
          sectionKey: 'ANAMNESIS_PROXIMA',
          data: {
            perfilDolorAbdominal: {
              presente: true,
              vomitos: true,
              asociadoComida: 'NO',
            },
          },
        },
        {
          sectionKey: 'RESPUESTA_TRATAMIENTO',
          data: {
            respuestaEstructurada: { estado: 'SIN_RESPUESTA' },
          },
        },
      ],
    });

    expect(encounter.symptomSignals.map((entry) => entry.key)).toEqual(expect.arrayContaining(['dolor abdominal', 'vomitos']));
    expect(encounter.foodRelation).toBe('NOT_ASSOCIATED');
    expect(encounter.hasFavorableResponse).toBe(false);
    expect(encounter.hasUnfavorableResponse).toBe(true);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'dolor abdominal')).toBe(true);
  });

  it('matches normalized condition text across probable and diagnostic sources', () => {
    const encounter = {
      probableConditions: [{ key: 'hipertension arterial', label: 'Hipertensión arterial', source: 'AFECCION_PROBABLE' as const }],
      diagnosticConditions: [{ key: 'hipertension esencial', label: 'Hipertensión esencial', source: 'SOSPECHA_DIAGNOSTICA' as const, code: 'I10' }],
    };

    expect(matchesAnalyticsCondition(getEncounterConditions(encounter, 'ANY'), 'hipertension')).toBe(true);
    expect(matchesAnalyticsCondition(getEncounterConditions(encounter, 'SOSPECHA_DIAGNOSTICA'), 'i10')).toBe(true);
    expect(matchesAnalyticsCondition(getEncounterConditions(encounter, 'AFECCION_PROBABLE'), 'diabetes')).toBe(false);
  });

  it('matches symptom-driven cohorts through searchable clinical text when source is any', () => {
    const encounter = {
      probableConditions: [],
      diagnosticConditions: [],
      symptomSignals: [],
      searchableText: 'consulta por dolor abdominal con vomitos y diarrea postprandial',
    };

    expect(matchesAnalyticsQuery(encounter, 'ANY', 'dolor abdominal')).toBe(true);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'vomitos')).toBe(true);
    expect(matchesAnalyticsQuery(encounter, 'SOSPECHA_DIAGNOSTICA', 'dolor abdominal')).toBe(false);
  });
});