import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import {
  classifyFoodRelation,
  classifyStructuredFoodRelation,
  extractStructuredSymptomSignals,
  extractSymptomSignals,
  includesAny,
  normalizeClinicalText,
} from './clinical-analytics-text';
import {
  aggregateTreatmentOutcome,
  isDefined,
  resolveStructuredResponse,
  resolveAssociatedConditionLabels,
  uniqueBy,
} from './clinical-analytics-encounter-utils';
import type {
  RawEncounter,
  RawSection,
  ProbableConditionData,
  AnamnesisProximaData,
  RevisionSistemasData,
  ExamenFisicoData,
  DiagnosticData,
  TreatmentData,
  ResponseData,
  ParsedClinicalAnalyticsEncounter,
  EncounterDiagnosisEntry,
  EncounterOutcomeEntry,
} from './clinical-analytics-encounter';

type ClinicalTreatmentInputEntry = {
  id?: string;
  nombre?: string;
  dosis?: string;
  via?: string;
  frecuencia?: string;
  duracion?: string;
  indicacion?: string;
  estado?: string;
  sospechaId?: string;
};

type TreatmentOutcomeEntry = NonNullable<ResponseData['resultadosTratamientos']>[number];

const FAVORABLE_RESPONSE_PATTERNS = [
  'evolucion favorable',
  'buena respuesta',
  'respondio bien',
  'mejoria',
  'mejoro',
  'resuelto',
  'resolvio',
  'sin dolor',
  'sin sintomas',
  'asintomatic',
  'cede',
  'cedio',
];

const UNFAVORABLE_RESPONSE_PATTERNS = [
  'sin mejoria',
  'no mejora',
  'sin respuesta',
  'persiste',
  'continua con',
  'sigue con',
  'empeoro',
  'empeora',
  'refractario',
  'peor',
];

function getSectionData<T extends Record<string, unknown>>(sections: RawSection[], sectionKey: SectionKey): T {
  const section = sections.find((entry) => entry.sectionKey === sectionKey);

  if (!section) {
    return {} as T;
  }

  const normalized = formatEncounterSectionForRead({
    sectionKey: section.sectionKey,
    data: section.data,
    schemaVersion: section.schemaVersion,
  });

  return (normalized.data || {}) as T;
}

function buildTreatmentEntries(
  entries: Array<ClinicalTreatmentInputEntry> | undefined,
  getDetails: (entry: ClinicalTreatmentInputEntry) => string | undefined,
  diagnosisLabelById: Map<string, string>,
  commonAssociatedConditions: string[] | undefined,
  treatmentOutcomes: ResponseData['resultadosTratamientos'] | undefined,
) {
  return (entries || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      const linkedConditions = resolveAssociatedConditionLabels(
        entry.sospechaId,
        diagnosisLabelById,
        commonAssociatedConditions,
      );
      const treatmentOutcome = treatmentOutcomes?.find(
        (item: TreatmentOutcomeEntry) => item.treatmentItemId === entry.id,
      );

      return {
        key: normalizeConditionName(label),
        label,
        details: getDetails(entry),
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(treatmentOutcome?.adherenceStatus ? { adherenceStatus: treatmentOutcome.adherenceStatus } : {}),
        ...(treatmentOutcome?.adverseEventSeverity ? { adverseEventSeverity: treatmentOutcome.adverseEventSeverity } : {}),
        ...(treatmentOutcome?.adverseEventNotes ? { adverseEventNotes: treatmentOutcome.adverseEventNotes } : {}),
      };
    })
    .filter(isDefined);
}

export function buildClinicalAnalyticsEncounter(rawEncounter: RawEncounter): ParsedClinicalAnalyticsEncounter {
  const motivo = getSectionData<ProbableConditionData>(rawEncounter.sections, 'MOTIVO_CONSULTA');
  const anamnesis = getSectionData<AnamnesisProximaData>(rawEncounter.sections, 'ANAMNESIS_PROXIMA');
  const revision = getSectionData<RevisionSistemasData>(rawEncounter.sections, 'REVISION_SISTEMAS');
  const examenFisico = getSectionData<ExamenFisicoData>(rawEncounter.sections, 'EXAMEN_FISICO');
  const diagnostico = getSectionData<DiagnosticData>(rawEncounter.sections, 'SOSPECHA_DIAGNOSTICA');
  const tratamiento = getSectionData<TreatmentData>(rawEncounter.sections, 'TRATAMIENTO');
  const respuesta = getSectionData<ResponseData>(rawEncounter.sections, 'RESPUESTA_TRATAMIENTO');

  const searchableText = normalizeClinicalText([
    motivo.texto,
    motivo.afeccionSeleccionada?.name,
    anamnesis.relatoAmpliado,
    anamnesis.sintomasAsociados,
    anamnesis.factoresAgravantes,
    anamnesis.factoresAtenuantes,
    anamnesis.perfilDolorAbdominal?.notas,
    revision.gastrointestinal?.notas,
    examenFisico.abdomen,
  ].filter(Boolean).join(' '));

  const structuredFoodRelation = classifyStructuredFoodRelation(anamnesis.perfilDolorAbdominal?.asociadoComida);
  const foodRelation = structuredFoodRelation !== 'UNSPECIFIED'
    ? structuredFoodRelation
    : classifyFoodRelation(normalizeClinicalText([
        anamnesis.factoresAgravantes,
        anamnesis.relatoAmpliado,
        anamnesis.sintomasAsociados,
        anamnesis.perfilDolorAbdominal?.notas,
        revision.gastrointestinal?.notas,
      ].filter(Boolean).join(' ')));

  const responseText = normalizeClinicalText([
    respuesta.evolucion,
    respuesta.resultadosExamenes,
    respuesta.respuestaEstructurada?.notas,
  ].filter(Boolean).join(' '));
  const structuredResponse = resolveStructuredResponse(respuesta.respuestaEstructurada);
  const treatmentOutcomeFromSection = aggregateTreatmentOutcome(
    (respuesta.resultadosTratamientos || []).map((entry: TreatmentOutcomeEntry) => ({
      outcomeStatus: entry.estado || 'UNKNOWN',
      outcomeSource: entry.estado ? 'ESTRUCTURADO' : 'TEXTO',
      notes: entry.notas,
      adherenceStatus: entry.adherenceStatus,
      adverseEventSeverity: entry.adverseEventSeverity,
      adverseEventNotes: entry.adverseEventNotes,
    })),
  );

  const probableConditions = uniqueBy(
    [motivo.afeccionSeleccionada]
      .filter((entry): entry is NonNullable<ProbableConditionData['afeccionSeleccionada']> => Boolean(entry?.name))
      .map((entry) => ({
        key: normalizeConditionName(entry.name as string),
        label: (entry.name as string).trim(),
        source: 'AFECCION_PROBABLE' as const,
      })),
    (entry) => entry.key,
  );

  const diagnosticConditions = uniqueBy(
    (diagnostico.sospechas || [])
      .map((entry) => {
        const label = (entry.diagnostico || entry.descripcionCie10 || '').trim();
        const code = entry.codigoCie10?.trim() || null;

        if (!label && !code) {
          return null;
        }

        return {
          key: normalizeConditionName(label || code || ''),
          label: label || code || 'Diagnóstico sin etiqueta',
          source: 'SOSPECHA_DIAGNOSTICA' as const,
          code,
        };
      })
      .filter(isDefined),
    (entry) => `${entry.key}:${entry.code ?? ''}`,
  );

  const diagnosticConditionLabelById = new Map<string, string>();
  for (const entry of diagnostico.sospechas || []) {
    const sourceId = entry.id?.trim();
    const label = (entry.diagnostico || entry.descripcionCie10 || entry.codigoCie10 || '').trim();
    if (sourceId && label) {
      diagnosticConditionLabelById.set(sourceId, label);
    }
  }

  const diagnoses: EncounterDiagnosisEntry[] = [...probableConditions, ...diagnosticConditions];
  const commonAssociatedConditions = uniqueBy(
    [...probableConditions, ...diagnosticConditions].map((entry) => entry.label.trim()),
    (label) => label,
  );

  const medications = buildTreatmentEntries(
    tratamiento.medicamentosEstructurados,
    (entry) => [entry.dosis, entry.via, entry.frecuencia, entry.duracion].filter(Boolean).join(' · ') || undefined,
    diagnosticConditionLabelById,
    commonAssociatedConditions.length > 0 ? commonAssociatedConditions : undefined,
    respuesta.resultadosTratamientos,
  );
  const exams = buildTreatmentEntries(
    tratamiento.examenesEstructurados,
    (entry) => [entry.estado, entry.indicacion].filter(Boolean).join(' · ') || undefined,
    diagnosticConditionLabelById,
    commonAssociatedConditions.length > 0 ? commonAssociatedConditions : undefined,
    respuesta.resultadosTratamientos,
  );
  const referrals = buildTreatmentEntries(
    tratamiento.derivacionesEstructuradas,
    (entry) => [entry.estado, entry.indicacion].filter(Boolean).join(' · ') || undefined,
    diagnosticConditionLabelById,
    commonAssociatedConditions.length > 0 ? commonAssociatedConditions : undefined,
    respuesta.resultadosTratamientos,
  );

  const hasFavorableResponse = treatmentOutcomeFromSection
    ? treatmentOutcomeFromSection.status === 'FAVORABLE'
    : structuredResponse
      ? structuredResponse.favorable
      : includesAny(responseText, FAVORABLE_RESPONSE_PATTERNS) && !includesAny(responseText, UNFAVORABLE_RESPONSE_PATTERNS);

  const hasUnfavorableResponse = treatmentOutcomeFromSection
    ? treatmentOutcomeFromSection.status === 'SIN_RESPUESTA' || treatmentOutcomeFromSection.status === 'EMPEORA'
    : structuredResponse
      ? structuredResponse.unfavorable
      : includesAny(responseText, UNFAVORABLE_RESPONSE_PATTERNS);

  const outcome: EncounterOutcomeEntry = treatmentOutcomeFromSection
    ? treatmentOutcomeFromSection
    : structuredResponse
      ? {
          status: structuredResponse.favorable ? 'FAVORABLE' : structuredResponse.unfavorable ? 'SIN_RESPUESTA' : 'PARCIAL',
          source: 'ESTRUCTURADO',
          notes: respuesta.respuestaEstructurada?.notas?.trim() || undefined,
        }
      : {
          status: hasFavorableResponse ? 'FAVORABLE' : hasUnfavorableResponse ? 'SIN_RESPUESTA' : 'UNKNOWN',
          source: 'TEXTO',
          notes: responseText || undefined,
        };

  const symptomSignals = uniqueBy(
    [...extractStructuredSymptomSignals(anamnesis.perfilDolorAbdominal), ...extractSymptomSignals(searchableText)],
    (entry) => entry.key,
  );

  return {
    encounterId: rawEncounter.id,
    patientId: rawEncounter.patientId,
    createdAt: rawEncounter.createdAt,
    patient: rawEncounter.patient,
    episode: null,
    probableConditions,
    diagnosticConditions,
    diagnoses,
    symptomSignals,
    medications,
    exams,
    referrals,
    searchableText,
    foodRelation,
    outcome,
    hasStructuredTreatment: medications.length > 0 || exams.length > 0 || referrals.length > 0,
    hasTreatmentAdjustment: Boolean(respuesta.ajustesTratamiento?.trim()),
    hasFollowUpPlan: Boolean(respuesta.planSeguimiento?.trim() || respuesta.evolucion?.trim()),
    hasFavorableResponse,
    hasUnfavorableResponse,
    hasDocumentedAdherence: Boolean(treatmentOutcomeFromSection?.adherenceStatus),
    hasAdverseEvent: Boolean(treatmentOutcomeFromSection?.adverseEventSeverity),
  };
}
