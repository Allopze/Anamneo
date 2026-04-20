import { SectionKey } from '../common/types';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';
import { normalizeConditionName } from '../conditions/conditions-helpers';
import type { ClinicalAnalyticsSource } from './dto/clinical-analytics-query.dto';

type RawSection = {
  sectionKey: string;
  data: unknown;
  schemaVersion?: number | null;
};

type RawEncounter = {
  id: string;
  patientId: string;
  createdAt: Date;
  patient: {
    id: string;
    edad: number | null;
    sexo: string | null;
    prevision: string | null;
  };
  sections: RawSection[];
};

type ProbableConditionData = {
  texto?: string;
  afeccionSeleccionada?: {
    id?: string;
    name?: string;
    confidence?: number;
  } | null;
};

type DiagnosticData = {
  sospechas?: Array<{
    diagnostico?: string;
    codigoCie10?: string;
    descripcionCie10?: string;
  }>;
};

type AnamnesisProximaData = {
  relatoAmpliado?: string;
  factoresAgravantes?: string;
  factoresAtenuantes?: string;
  sintomasAsociados?: string;
  perfilDolorAbdominal?: {
    presente?: boolean;
    vomitos?: boolean;
    diarrea?: boolean;
    nauseas?: boolean;
    estrenimiento?: boolean;
    asociadoComida?: 'SI' | 'NO' | 'NO_CLARO';
    notas?: string;
  };
};

type RevisionSystemItem = {
  checked?: boolean;
  notas?: string;
};

type RevisionSistemasData = {
  gastrointestinal?: RevisionSystemItem;
};

type ExamenFisicoData = {
  abdomen?: string;
};

type TreatmentData = {
  medicamentosEstructurados?: Array<{
    nombre?: string;
    dosis?: string;
    via?: string;
    frecuencia?: string;
    duracion?: string;
  }>;
  examenesEstructurados?: Array<{
    nombre?: string;
    indicacion?: string;
    estado?: string;
  }>;
  derivacionesEstructuradas?: Array<{
    nombre?: string;
    indicacion?: string;
    estado?: string;
  }>;
};

type ResponseData = {
  ajustesTratamiento?: string;
  planSeguimiento?: string;
  evolucion?: string;
  resultadosExamenes?: string;
  respuestaEstructurada?: {
    estado?: 'FAVORABLE' | 'PARCIAL' | 'SIN_RESPUESTA' | 'EMPEORA';
    notas?: string;
  };
};

const SYMPTOM_SIGNAL_DEFINITIONS = [
  {
    key: 'dolor abdominal',
    label: 'Dolor abdominal',
    patterns: ['dolor abdominal', 'dolor en abdomen', 'abdomen doloroso', 'epigastralgia', 'dolor epigastrico'],
  },
  {
    key: 'vomitos',
    label: 'Vómitos',
    patterns: ['vomito', 'vomitos', 'vomitando', 'emesis'],
  },
  {
    key: 'diarrea',
    label: 'Diarrea',
    patterns: ['diarrea', 'deposiciones liquidas'],
  },
  {
    key: 'nauseas',
    label: 'Náuseas',
    patterns: ['nausea', 'nauseas'],
  },
  {
    key: 'fiebre',
    label: 'Fiebre',
    patterns: ['fiebre', 'febril'],
  },
  {
    key: 'distension abdominal',
    label: 'Distensión abdominal',
    patterns: ['distension abdominal', 'meteorismo', 'hinchazon abdominal'],
  },
  {
    key: 'estrenimiento',
    label: 'Estreñimiento',
    patterns: ['estrenimiento', 'constipacion'],
  },
] as const;

const FOOD_ASSOCIATED_PATTERNS = [
  'postprandial',
  'post prandial',
  'asociado a comida',
  'asociado a comidas',
  'relacion con comida',
  'relacion con comidas',
  'tras comer',
  'despues de comer',
  'luego de comer',
  'al comer',
  'ingesta alimentaria',
  'alimentos',
];

const FOOD_NOT_ASSOCIATED_PATTERNS = [
  'sin relacion con comida',
  'sin relacion con comidas',
  'no asociado a comida',
  'no asociado a comidas',
  'no relacionado con comida',
  'no relacionado con comidas',
  'independiente de comidas',
  'no postprandial',
  'sin asociacion a alimentos',
];

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

export type AnalyticsSourceValue = Exclude<ClinicalAnalyticsSource, 'ANY'>;

export type FoodRelation = 'ASSOCIATED' | 'NOT_ASSOCIATED' | 'UNSPECIFIED';

export type ClinicalConditionEntry = {
  key: string;
  label: string;
  source: AnalyticsSourceValue;
  code?: string | null;
};

export type ClinicalSymptomEntry = {
  key: string;
  label: string;
};

export type ClinicalTreatmentEntry = {
  key: string;
  label: string;
  details?: string;
};

export type ParsedClinicalAnalyticsEncounter = {
  encounterId: string;
  patientId: string;
  createdAt: Date;
  patient: RawEncounter['patient'];
  probableConditions: ClinicalConditionEntry[];
  diagnosticConditions: ClinicalConditionEntry[];
  symptomSignals: ClinicalSymptomEntry[];
  medications: ClinicalTreatmentEntry[];
  exams: ClinicalTreatmentEntry[];
  referrals: ClinicalTreatmentEntry[];
  searchableText: string;
  foodRelation: FoodRelation;
  hasStructuredTreatment: boolean;
  hasTreatmentAdjustment: boolean;
  hasFollowUpPlan: boolean;
  hasFavorableResponse: boolean;
  hasUnfavorableResponse: boolean;
};

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

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = getKey(value);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function normalizeClinicalText(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return normalizeConditionName(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(text: string, patterns: readonly string[]) {
  if (!text) {
    return false;
  }

  return patterns.some((pattern) => text.includes(pattern));
}

function extractSymptomSignals(text: string) {
  return SYMPTOM_SIGNAL_DEFINITIONS
    .filter((definition) => includesAny(text, definition.patterns))
    .map((definition) => ({ key: definition.key, label: definition.label }));
}

function extractStructuredSymptomSignals(perfilDolorAbdominal: AnamnesisProximaData['perfilDolorAbdominal']) {
  if (!perfilDolorAbdominal) {
    return [] as ClinicalSymptomEntry[];
  }

  return [
    perfilDolorAbdominal.presente ? { key: 'dolor abdominal', label: 'Dolor abdominal' } : null,
    perfilDolorAbdominal.vomitos ? { key: 'vomitos', label: 'Vómitos' } : null,
    perfilDolorAbdominal.diarrea ? { key: 'diarrea', label: 'Diarrea' } : null,
    perfilDolorAbdominal.nauseas ? { key: 'nauseas', label: 'Náuseas' } : null,
    perfilDolorAbdominal.estrenimiento ? { key: 'estrenimiento', label: 'Estreñimiento' } : null,
  ].filter(isDefined);
}

function classifyFoodRelation(text: string): FoodRelation {
  if (includesAny(text, FOOD_NOT_ASSOCIATED_PATTERNS)) {
    return 'NOT_ASSOCIATED';
  }

  if (includesAny(text, FOOD_ASSOCIATED_PATTERNS)) {
    return 'ASSOCIATED';
  }

  return 'UNSPECIFIED';
}

function classifyStructuredFoodRelation(value: 'SI' | 'NO' | 'NO_CLARO' | undefined): FoodRelation {
  if (value === 'SI') {
    return 'ASSOCIATED';
  }

  if (value === 'NO') {
    return 'NOT_ASSOCIATED';
  }

  return 'UNSPECIFIED';
}

function resolveStructuredResponse(respuestaEstructurada: ResponseData['respuestaEstructurada']) {
  if (!respuestaEstructurada?.estado) {
    return null;
  }

  return {
    favorable: respuestaEstructurada.estado === 'FAVORABLE',
    unfavorable: respuestaEstructurada.estado === 'SIN_RESPUESTA' || respuestaEstructurada.estado === 'EMPEORA',
  };
}

export function getEncounterConditions(
  encounter: Pick<ParsedClinicalAnalyticsEncounter, 'probableConditions' | 'diagnosticConditions'>,
  source: ClinicalAnalyticsSource,
) {
  if (source === 'AFECCION_PROBABLE') {
    return encounter.probableConditions;
  }

  if (source === 'SOSPECHA_DIAGNOSTICA') {
    return encounter.diagnosticConditions;
  }

  return uniqueBy([...encounter.probableConditions, ...encounter.diagnosticConditions], (entry) => `${entry.key}:${entry.code ?? ''}`);
}

export function matchesAnalyticsCondition(entries: ClinicalConditionEntry[], normalizedCondition: string) {
  if (!normalizedCondition) {
    return true;
  }

  return entries.some((entry) => entry.key.includes(normalizedCondition) || entry.code?.toLowerCase().includes(normalizedCondition));
}

export function matchesAnalyticsQuery(
  encounter: Pick<ParsedClinicalAnalyticsEncounter, 'probableConditions' | 'diagnosticConditions' | 'searchableText' | 'symptomSignals'>,
  source: ClinicalAnalyticsSource,
  normalizedCondition: string,
) {
  if (!normalizedCondition) {
    return true;
  }

  if (matchesAnalyticsCondition(getEncounterConditions(encounter, source), normalizedCondition)) {
    return true;
  }

  if (source !== 'ANY') {
    return false;
  }

  if (encounter.symptomSignals.some((entry) => entry.key.includes(normalizedCondition))) {
    return true;
  }

  return encounter.searchableText.includes(normalizedCondition);
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

  const medications = (tratamiento.medicamentosEstructurados || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      return {
        key: normalizeConditionName(label),
        label,
        details: [entry.dosis, entry.via, entry.frecuencia, entry.duracion].filter(Boolean).join(' · ') || undefined,
      };
    })
    .filter(isDefined);

  const exams = (tratamiento.examenesEstructurados || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      return {
        key: normalizeConditionName(label),
        label,
        details: [entry.estado, entry.indicacion].filter(Boolean).join(' · ') || undefined,
      };
    })
    .filter(isDefined);

  const referrals = (tratamiento.derivacionesEstructuradas || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      return {
        key: normalizeConditionName(label),
        label,
        details: [entry.estado, entry.indicacion].filter(Boolean).join(' · ') || undefined,
      };
    })
    .filter(isDefined);

  const symptomSignals = uniqueBy(
    [...extractStructuredSymptomSignals(anamnesis.perfilDolorAbdominal), ...extractSymptomSignals(searchableText)],
    (entry) => entry.key,
  );

  return {
    encounterId: rawEncounter.id,
    patientId: rawEncounter.patientId,
    createdAt: rawEncounter.createdAt,
    patient: rawEncounter.patient,
    probableConditions,
    diagnosticConditions,
    symptomSignals,
    medications,
    exams,
    referrals,
    searchableText,
    foodRelation,
    hasStructuredTreatment: medications.length > 0 || exams.length > 0 || referrals.length > 0,
    hasTreatmentAdjustment: Boolean(respuesta.ajustesTratamiento?.trim()),
    hasFollowUpPlan: Boolean(respuesta.planSeguimiento?.trim() || respuesta.evolucion?.trim()),
    hasFavorableResponse: structuredResponse
      ? structuredResponse.favorable
      : includesAny(responseText, FAVORABLE_RESPONSE_PATTERNS) && !includesAny(responseText, UNFAVORABLE_RESPONSE_PATTERNS),
    hasUnfavorableResponse: structuredResponse
      ? structuredResponse.unfavorable
      : includesAny(responseText, UNFAVORABLE_RESPONSE_PATTERNS),
  };
}