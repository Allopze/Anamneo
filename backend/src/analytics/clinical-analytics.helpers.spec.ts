import {
  buildClinicalAnalyticsEncounter,
  buildClinicalAnalyticsEncounterFromPersistence,
  getEncounterConditions,
  matchesAnalyticsCondition,
  matchesAnalyticsQuery,
} from './clinical-analytics.helpers';

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

  it('narrows treatment condition labels when the section stores an explicit diagnostic suspicion id', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-explicit',
      patientId: 'pat-explicit',
      createdAt: new Date('2026-04-03T12:00:00.000Z'),
      patient: {
        id: 'pat-explicit',
        fechaNacimiento: null,
        edad: 35,
        sexo: 'F',
        prevision: 'FONASA',
      },
      sections: [
        {
          sectionKey: 'SOSPECHA_DIAGNOSTICA',
          data: {
            sospechas: [
              { id: 'dx-1', diagnostico: 'Gastritis aguda' },
              { id: 'dx-2', diagnostico: 'Colecistitis' },
            ],
          },
        },
        {
          sectionKey: 'TRATAMIENTO',
          data: {
            medicamentosEstructurados: [{ id: 'med-1', nombre: 'Omeprazol', sospechaId: 'dx-1' }],
            examenesEstructurados: [{ id: 'exam-1', nombre: 'Ecografía abdominal', sospechaId: 'dx-2' }],
          },
        },
      ],
    });

    expect(encounter.medications[0].associatedConditionLabels).toEqual(['Gastritis aguda']);
    expect(encounter.exams[0].associatedConditionLabels).toEqual(['Colecistitis']);
  });

  it('prioritizes treatment-specific outcomes over the global fallback response', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-outcomes',
      patientId: 'pat-outcomes',
      createdAt: new Date('2026-04-03T12:00:00.000Z'),
      patient: {
        id: 'pat-outcomes',
        fechaNacimiento: null,
        edad: 46,
        sexo: 'F',
        prevision: 'FONASA',
      },
      sections: [
        {
          sectionKey: 'TRATAMIENTO',
          data: {
            medicamentosEstructurados: [{ id: 'med-1', nombre: 'Omeprazol' }],
          },
        },
        {
          sectionKey: 'RESPUESTA_TRATAMIENTO',
          data: {
            respuestaEstructurada: { estado: 'SIN_RESPUESTA', notas: 'Persisten síntomas' },
            resultadosTratamientos: [{ treatmentItemId: 'med-1', estado: 'FAVORABLE', notas: 'Cede el dolor' }],
          },
        },
      ],
    });

    expect(encounter.outcome).toEqual(expect.objectContaining({ status: 'FAVORABLE', source: 'ESTRUCTURADO' }));
    expect(encounter.hasFavorableResponse).toBe(true);
    expect(encounter.hasUnfavorableResponse).toBe(false);
  });

  it('captures adherence and adverse event signals from treatment-specific outcomes', () => {
    const encounter = buildClinicalAnalyticsEncounter({
      id: 'enc-adherence',
      patientId: 'pat-adherence',
      createdAt: new Date('2026-04-03T12:00:00.000Z'),
      patient: {
        id: 'pat-adherence',
        fechaNacimiento: null,
        edad: 46,
        sexo: 'F',
        prevision: 'FONASA',
      },
      sections: [
        {
          sectionKey: 'TRATAMIENTO',
          data: {
            medicamentosEstructurados: [{ id: 'med-1', nombre: 'Omeprazol' }],
          },
        },
        {
          sectionKey: 'RESPUESTA_TRATAMIENTO',
          data: {
            resultadosTratamientos: [
              {
                treatmentItemId: 'med-1',
                adherenceStatus: 'NO_ADHERENTE',
                adverseEventSeverity: 'LEVE',
                adverseEventNotes: 'Náuseas leves',
              },
            ],
          },
        },
      ],
    });

    expect(encounter.hasDocumentedAdherence).toBe(true);
    expect(encounter.hasAdverseEvent).toBe(true);
    expect(encounter.outcome.adherenceStatus).toBe('NO_ADHERENTE');
    expect(encounter.outcome.adverseEventSeverity).toBe('LEVE');
    expect(encounter.medications[0]).toEqual(expect.objectContaining({
      adherenceStatus: 'NO_ADHERENTE',
      adverseEventSeverity: 'LEVE',
      adverseEventNotes: 'Náuseas leves',
    }));
  });
});

