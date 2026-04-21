import { buildClinicalAnalyticsEncounter, getEncounterConditions, matchesAnalyticsCondition, matchesAnalyticsQuery } from './clinical-analytics.helpers';

describe('clinical-analytics.helpers', () => {
  it('extracts conditions, symptoms, food association and response proxies from encounter sections', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-1',
      patientId: 'pat-1',
      createdAt: new Date('2026-04-01T12:00:00.000Z'),
      patient: {
        id: 'pat-1',
        fechaNacimiento: new Date('1984-05-10T12:00:00.000Z'),
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
    expect(encounter.diagnoses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'AFECCION_PROBABLE' }),
        expect.objectContaining({ source: 'SOSPECHA_DIAGNOSTICA', code: 'I10' }),
      ]),
    );
    expect(encounter.medications[0].label).toBe('Enalapril');
    expect(encounter.medications[0].associatedConditionLabels).toEqual(['Hipertensión arterial', 'Hipertensión esencial']);
    expect(encounter.exams[0].label).toBe('Perfil lipídico');
    expect(encounter.exams[0].associatedConditionLabels).toEqual(['Hipertensión arterial', 'Hipertensión esencial']);
    expect(encounter.symptomSignals.map((entry) => entry.label)).toEqual(expect.arrayContaining(['Dolor abdominal', 'Vómitos', 'Diarrea']));
    expect(encounter.foodRelation).toBe('ASSOCIATED');
    expect(encounter.outcome).toEqual(expect.objectContaining({ status: 'FAVORABLE', source: 'ESTRUCTURADO' }));
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
        fechaNacimiento: null,
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

  it('keeps affirmative symptoms visible after a negated clause when matching raw searchable text', () => {
    const encounter = {
      probableConditions: [],
      diagnosticConditions: [],
      symptomSignals: [],
      searchableText: 'niega presencia de nauseas fiebre o distension abdominal pero refiere dolor abdominal postprandial',
    };

    expect(matchesAnalyticsQuery(encounter, 'ANY', 'nauseas')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'fiebre')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'distension abdominal')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'dolor abdominal')).toBe(true);
  });

  it('excludes negated symptom mentions from symptom-driven matching', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-3',
      patientId: 'pat-3',
      createdAt: new Date('2026-04-05T12:00:00.000Z'),
      patient: {
        id: 'pat-3',
        fechaNacimiento: null,
        edad: 29,
        sexo: 'F',
        prevision: 'FONASA',
      },
      sections: [
        {
          sectionKey: 'ANAMNESIS_PROXIMA',
          data: {
            relatoAmpliado: 'Paciente sin dolor abdominal, niega vomitos y descarta diarrea.',
            sintomasAsociados: 'Sin vomitos ni diarrea',
          },
        },
      ],
    });

    expect(encounter.symptomSignals).toEqual([]);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'dolor abdominal')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'vomitos')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'diarrea')).toBe(false);
  });

  it('excludes broader negated symptom lists and preserves later affirmative findings', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-4',
      patientId: 'pat-4',
      createdAt: new Date('2026-04-06T12:00:00.000Z'),
      patient: {
        id: 'pat-4',
        fechaNacimiento: null,
        edad: 41,
        sexo: 'M',
        prevision: 'ISAPRE',
      },
      sections: [
        {
          sectionKey: 'ANAMNESIS_PROXIMA',
          data: {
            relatoAmpliado: 'Paciente niega presencia de nauseas, fiebre o distension abdominal; libre de estrenimiento, pero refiere dolor abdominal postprandial.',
            sintomasAsociados: 'No presenta vomitos ni diarrea.',
          },
        },
      ],
    });

    expect(encounter.symptomSignals).toEqual([
      { key: 'dolor abdominal', label: 'Dolor abdominal' },
    ]);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'nauseas')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'fiebre')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'distension abdominal')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'estrenimiento')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'vomitos')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'diarrea')).toBe(false);
    expect(matchesAnalyticsQuery(encounter, 'ANY', 'dolor abdominal')).toBe(true);
  });
});