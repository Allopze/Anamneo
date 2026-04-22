import { 
  buildClinicalAnalyticsEncounter,
  buildClinicalAnalyticsEncounterFromPersistence,
  getEncounterConditions,
  matchesAnalyticsCondition,
  matchesAnalyticsQuery,
} from './clinical-analytics.helpers';

describe('clinical-analytics.helpers matching and persistence', () => {
  it('uses persisted treatment diagnosis relations when available', () => {
    const encounter = buildClinicalAnalyticsEncounterFromPersistence({
      id: 'enc-persisted',
      patientId: 'pat-persisted',
      createdAt: new Date('2026-04-03T12:00:00.000Z'),
      patient: {
        id: 'pat-persisted',
        fechaNacimiento: null,
        edad: 61,
        sexo: 'M',
        prevision: 'ISAPRE',
      },
      sections: [],
      diagnoses: [
        {
          source: 'SOSPECHA_DIAGNOSTICA',
          label: 'Gastritis aguda',
          normalizedLabel: 'gastritis aguda',
          code: null,
        },
        {
          source: 'SOSPECHA_DIAGNOSTICA',
          label: 'Colecistitis',
          normalizedLabel: 'colecistitis',
          code: null,
        },
      ],
      treatments: [
        {
          treatmentType: 'MEDICATION',
          label: 'Omeprazol',
          normalizedLabel: 'omeprazol',
          diagnosis: {
            label: 'Gastritis aguda',
            normalizedLabel: 'gastritis aguda',
          },
          outcomes: [],
        },
      ],
      episode: null,
    } as any);

    expect(encounter.medications[0].associatedConditionLabels).toEqual(['Gastritis aguda']);
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
