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
    fechaNacimiento?: Date | null;
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
    id?: string;
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
    id?: string;
    nombre?: string;
    dosis?: string;
    via?: string;
    frecuencia?: string;
    duracion?: string;
    sospechaId?: string;
  }>;
  examenesEstructurados?: Array<{
    id?: string;
    nombre?: string;
    indicacion?: string;
    estado?: string;
    sospechaId?: string;
  }>;
  derivacionesEstructuradas?: Array<{
    id?: string;
    nombre?: string;
    indicacion?: string;
    estado?: string;
    sospechaId?: string;
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
  resultadosTratamientos?: Array<{
    treatmentItemId?: string;
    estado?: 'FAVORABLE' | 'PARCIAL' | 'SIN_RESPUESTA' | 'EMPEORA';
    notas?: string;
    adherenceStatus?: 'ADHERENTE' | 'PARCIAL' | 'NO_ADHERENTE';
    adverseEventSeverity?: 'LEVE' | 'MODERADO' | 'SEVERO';
    adverseEventNotes?: string;
  }>;
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

const SYMPTOM_NEGATION_PREFIXES = [
  'sin',
  'niega',
  'niega presencia de',
  'descarta',
  'ausencia de',
  'libre de',
  'sin evidencia de',
  'sin evidencia clinica de',
  'sin signos de',
  'sin datos de',
  'sin sintomas de',
  'sin sintomatologia de',
  'no presenta',
  'no refiere',
  'no hay',
] as const;

const NEGATION_CLAUSE_BOUNDARY_REGEX = /[.;:]|,\s*(?:pero|aunque|sin embargo|excepto|salvo|refiere|presenta|describe|cursa|consulta|evoluciona|persiste|continua|sigue)\b|\b(?:pero|aunque|sin embargo|excepto|salvo)\b/g;
const NEGATION_BLOCKING_REGEX = /(?:^|[\s,])(?:pero|aunque|sin embargo|excepto|salvo|refiere|presenta|describe|cursa|consulta|evoluciona|persiste|continua|sigue|con|acompanado|acompanada|asociado|asociada)\b/;
const MAX_NEGATION_WORD_DISTANCE = 12;

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
  associatedConditionLabels?: string[];
  adherenceStatus?: 'ADHERENTE' | 'PARCIAL' | 'NO_ADHERENTE';
  adverseEventSeverity?: 'LEVE' | 'MODERADO' | 'SEVERO';
  adverseEventNotes?: string;
};

export type EncounterDiagnosisEntry = {
  key: string;
  label: string;
  source: AnalyticsSourceValue;
  code?: string | null;
};

export type EncounterOutcomeEntry = {
  status: 'FAVORABLE' | 'PARCIAL' | 'SIN_RESPUESTA' | 'EMPEORA' | 'PROXY' | 'UNKNOWN';
  source: 'ESTRUCTURADO' | 'TEXTO' | 'PROBLEM_RESOLUTION';
  notes?: string;
  adherenceStatus?: 'ADHERENTE' | 'PARCIAL' | 'NO_ADHERENTE';
  adverseEventSeverity?: 'LEVE' | 'MODERADO' | 'SEVERO';
  adverseEventNotes?: string;
};

export type EncounterEpisodeEntry = {
  id: string;
  key: string;
  label: string;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive: boolean;
};

type RawPersistentDiagnosis = {
  source: 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
  label: string;
  normalizedLabel: string;
  code?: string | null;
};

type RawPersistentTreatment = {
  treatmentType: 'MEDICATION' | 'EXAM' | 'REFERRAL';
  label: string;
  normalizedLabel: string;
  details?: string | null;
  dose?: string | null;
  route?: string | null;
  frequency?: string | null;
  duration?: string | null;
  indication?: string | null;
  status?: string | null;
  diagnosis?: { label?: string | null; normalizedLabel?: string | null } | null;
  outcomes?: Array<{
    outcomeStatus: string;
    outcomeSource: string;
    notes?: string | null;
    adherenceStatus?: string | null;
    adverseEventSeverity?: string | null;
    adverseEventNotes?: string | null;
  }> | null;
};

function aggregateAdherenceStatus(values: Array<string | null | undefined>) {
  const filtered = values.filter(Boolean) as string[];
  if (filtered.includes('NO_ADHERENTE')) {
    return 'NO_ADHERENTE' as const;
  }
  if (filtered.includes('PARCIAL')) {
    return 'PARCIAL' as const;
  }
  if (filtered.includes('ADHERENTE')) {
    return 'ADHERENTE' as const;
  }
  return undefined;
}

function aggregateAdverseEventSeverity(values: Array<string | null | undefined>) {
  const filtered = values.filter(Boolean) as string[];
  if (filtered.includes('SEVERO')) {
    return 'SEVERO' as const;
  }
  if (filtered.includes('MODERADO')) {
    return 'MODERADO' as const;
  }
  if (filtered.includes('LEVE')) {
    return 'LEVE' as const;
  }
  return undefined;
}

function resolveAssociatedConditionLabels(
  sospechaId: string | undefined,
  diagnosisLabelById: Map<string, string>,
  fallback?: string[],
) {
  const normalizedId = sospechaId?.trim();
  if (!normalizedId) {
    return fallback;
  }

  const diagnosisLabel = diagnosisLabelById.get(normalizedId);
  if (!diagnosisLabel) {
    return fallback;
  }

  return [diagnosisLabel];
}

type RawEncounterWithPersistence = RawEncounter & {
  diagnoses?: RawPersistentDiagnosis[];
  treatments?: RawPersistentTreatment[];
  episode?: { id: string; label: string; normalizedLabel: string; startDate?: Date | null; endDate?: Date | null; isActive: boolean } | null;
};

function aggregateTreatmentOutcome(outcomes: Array<{
  outcomeStatus: string;
  outcomeSource: string;
  notes?: string | null;
  adherenceStatus?: string | null;
  adverseEventSeverity?: string | null;
  adverseEventNotes?: string | null;
}> | undefined): EncounterOutcomeEntry | null {
  if (!outcomes || outcomes.length === 0) {
    return null;
  }

  const normalized = outcomes.map((outcome) => ({
    status: outcome.outcomeStatus,
    source: outcome.outcomeSource,
    notes: outcome.notes ?? undefined,
    adherenceStatus: outcome.adherenceStatus ?? undefined,
    adverseEventSeverity: outcome.adverseEventSeverity ?? undefined,
    adverseEventNotes: outcome.adverseEventNotes ?? undefined,
  }));

  const notes = normalized.map((item) => item.notes).filter(Boolean).join(' \n') || undefined;
  const adverseEventNotes = normalized.map((item) => item.adverseEventNotes).filter(Boolean).join(' \n') || undefined;
  const source = normalized[0].source as EncounterOutcomeEntry['source'];
  const adherenceStatus = aggregateAdherenceStatus(normalized.map((item) => item.adherenceStatus));
  const adverseEventSeverity = aggregateAdverseEventSeverity(normalized.map((item) => item.adverseEventSeverity));

  if (normalized.some((item) => item.status === 'FAVORABLE')) {
    return { status: 'FAVORABLE', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
  }

  if (normalized.some((item) => item.status === 'SIN_RESPUESTA' || item.status === 'EMPEORA')) {
    return { status: 'SIN_RESPUESTA', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
  }

  if (normalized.some((item) => item.status === 'PARCIAL')) {
    return { status: 'PARCIAL', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
  }

  return { status: 'UNKNOWN', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
}

export function buildClinicalAnalyticsEncounterFromPersistence(rawEncounter: RawEncounterWithPersistence) {
  const parsedBySections = buildClinicalAnalyticsEncounter(rawEncounter as RawEncounter);

  if (!rawEncounter.diagnoses && !rawEncounter.treatments && !rawEncounter.episode) {
    return parsedBySections;
  }

  const persistedDiagnoses = rawEncounter.diagnoses?.map((entry) => ({
    key: entry.normalizedLabel,
    label: entry.label,
    source: entry.source,
    code: entry.code ?? null,
  })) ?? [];

  const diagnoses = uniqueBy(
    [...parsedBySections.diagnoses, ...persistedDiagnoses],
    (entry) => `${entry.source}:${entry.key}:${entry.code ?? ''}`,
  );

  const probableConditions = uniqueBy([
    ...parsedBySections.probableConditions,
    ...diagnoses.filter(
    (entry): entry is ClinicalConditionEntry => entry.source === 'AFECCION_PROBABLE',
    ),
  ], (entry) => `${entry.key}:${entry.code ?? ''}`);
  const diagnosticConditions = uniqueBy([
    ...parsedBySections.diagnosticConditions,
    ...diagnoses.filter(
    (entry): entry is ClinicalConditionEntry => entry.source === 'SOSPECHA_DIAGNOSTICA',
    ),
  ], (entry) => `${entry.key}:${entry.code ?? ''}`);

  const associatedConditionLabels = diagnoses.length > 0 ? [...new Set(diagnoses.map((entry) => entry.label.trim()))] : undefined;

  const resolvePersistedAssociatedConditions = (entry: RawPersistentTreatment) => {
    const diagnosisLabel = entry.diagnosis?.label?.trim();
    if (diagnosisLabel) {
      return [diagnosisLabel];
    }

    return associatedConditionLabels;
  };

  const persistedMedications = (rawEncounter.treatments ?? [])
    .filter((entry) => entry.treatmentType === 'MEDICATION')
    .map((entry) => {
      const linkedConditions = resolvePersistedAssociatedConditions(entry);
      const aggregatedOutcome = aggregateTreatmentOutcome(entry.outcomes ?? undefined);

      return {
        key: entry.normalizedLabel,
        label: entry.label,
        details: entry.details ?? undefined,
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(aggregatedOutcome?.adherenceStatus ? { adherenceStatus: aggregatedOutcome.adherenceStatus } : {}),
        ...(aggregatedOutcome?.adverseEventSeverity ? { adverseEventSeverity: aggregatedOutcome.adverseEventSeverity } : {}),
        ...(aggregatedOutcome?.adverseEventNotes ? { adverseEventNotes: aggregatedOutcome.adverseEventNotes } : {}),
      };
    });

  const persistedExams = (rawEncounter.treatments ?? [])
    .filter((entry) => entry.treatmentType === 'EXAM')
    .map((entry) => {
      const linkedConditions = resolvePersistedAssociatedConditions(entry);
      const aggregatedOutcome = aggregateTreatmentOutcome(entry.outcomes ?? undefined);

      return {
        key: entry.normalizedLabel,
        label: entry.label,
        details: entry.details ?? undefined,
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(aggregatedOutcome?.adherenceStatus ? { adherenceStatus: aggregatedOutcome.adherenceStatus } : {}),
        ...(aggregatedOutcome?.adverseEventSeverity ? { adverseEventSeverity: aggregatedOutcome.adverseEventSeverity } : {}),
        ...(aggregatedOutcome?.adverseEventNotes ? { adverseEventNotes: aggregatedOutcome.adverseEventNotes } : {}),
      };
    });

  const persistedReferrals = (rawEncounter.treatments ?? [])
    .filter((entry) => entry.treatmentType === 'REFERRAL')
    .map((entry) => {
      const linkedConditions = resolvePersistedAssociatedConditions(entry);
      const aggregatedOutcome = aggregateTreatmentOutcome(entry.outcomes ?? undefined);

      return {
        key: entry.normalizedLabel,
        label: entry.label,
        details: entry.details ?? undefined,
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(aggregatedOutcome?.adherenceStatus ? { adherenceStatus: aggregatedOutcome.adherenceStatus } : {}),
        ...(aggregatedOutcome?.adverseEventSeverity ? { adverseEventSeverity: aggregatedOutcome.adverseEventSeverity } : {}),
        ...(aggregatedOutcome?.adverseEventNotes ? { adverseEventNotes: aggregatedOutcome.adverseEventNotes } : {}),
      };
    });

  const medications = uniqueBy(
    [...parsedBySections.medications, ...persistedMedications],
    (entry) => entry.key,
  );
  const exams = uniqueBy(
    [...parsedBySections.exams, ...persistedExams],
    (entry) => entry.key,
  );
  const referrals = uniqueBy(
    [...parsedBySections.referrals, ...persistedReferrals],
    (entry) => entry.key,
  );

  const outcome = aggregateTreatmentOutcome(
    rawEncounter.treatments?.flatMap((entry) => entry.outcomes ?? []) ?? [],
  ) ?? parsedBySections.outcome;

  return {
    ...parsedBySections,
    episode: rawEncounter.episode
      ? {
          id: rawEncounter.episode.id,
          key: rawEncounter.episode.normalizedLabel,
          label: rawEncounter.episode.label,
          startDate: rawEncounter.episode.startDate,
          endDate: rawEncounter.episode.endDate,
          isActive: rawEncounter.episode.isActive,
        }
      : parsedBySections.episode,
    probableConditions,
    diagnosticConditions,
    diagnoses,
    medications,
    exams,
    referrals,
    outcome,
    hasStructuredTreatment: medications.length > 0 || exams.length > 0 || referrals.length > 0 || parsedBySections.hasStructuredTreatment,
    hasFavorableResponse: outcome.status === 'FAVORABLE' || parsedBySections.hasFavorableResponse,
    hasUnfavorableResponse: outcome.status === 'SIN_RESPUESTA' || outcome.status === 'EMPEORA' || parsedBySections.hasUnfavorableResponse,
    hasDocumentedAdherence: Boolean(outcome.adherenceStatus) || parsedBySections.hasDocumentedAdherence,
    hasAdverseEvent: Boolean(outcome.adverseEventSeverity) || parsedBySections.hasAdverseEvent,
  };
};

export type ParsedClinicalAnalyticsEncounter = {
  encounterId: string;
  patientId: string;
  createdAt: Date;
  patient: RawEncounter['patient'];
  episode: EncounterEpisodeEntry | null;
  probableConditions: ClinicalConditionEntry[];
  diagnosticConditions: ClinicalConditionEntry[];
  diagnoses: EncounterDiagnosisEntry[];
  symptomSignals: ClinicalSymptomEntry[];
  medications: ClinicalTreatmentEntry[];
  exams: ClinicalTreatmentEntry[];
  referrals: ClinicalTreatmentEntry[];
  searchableText: string;
  foodRelation: FoodRelation;
  outcome: EncounterOutcomeEntry;
  hasStructuredTreatment: boolean;
  hasTreatmentAdjustment: boolean;
  hasFollowUpPlan: boolean;
  hasFavorableResponse: boolean;
  hasUnfavorableResponse: boolean;
  hasDocumentedAdherence: boolean;
  hasAdverseEvent: boolean;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesAny(text: string, patterns: readonly string[]) {
  if (!text) {
    return false;
  }

  return patterns.some((pattern) => text.includes(pattern));
}

function findPatternOccurrences(text: string, pattern: string) {
  const regex = new RegExp(`\\b${escapeRegExp(pattern)}\\b`, 'g');
  const matches: Array<{ start: number; end: number }> = [];

  for (const match of text.matchAll(regex)) {
    const start = match.index ?? -1;
    if (start < 0) {
      continue;
    }

    matches.push({ start, end: start + match[0].length });
  }

  return matches;
}

function findLastClauseBoundaryIndex(text: string, endIndex: number) {
  const prefix = text.slice(0, endIndex);
  let boundaryIndex = -1;

  for (const match of prefix.matchAll(NEGATION_CLAUSE_BOUNDARY_REGEX)) {
    const start = match.index ?? -1;
    if (start < 0) {
      continue;
    }

    boundaryIndex = start + match[0].length;
  }

  return boundaryIndex;
}

function findLastNegationCue(text: string) {
  let lastCue: { start: number; end: number } | null = null;

  for (const cue of SYMPTOM_NEGATION_PREFIXES) {
    const regex = new RegExp(`\\b${escapeRegExp(cue)}\\b`, 'g');

    for (const match of text.matchAll(regex)) {
      const start = match.index ?? -1;
      if (start < 0) {
        continue;
      }

      const candidate = { start, end: start + match[0].length };
      if (
        !lastCue
        || candidate.start > lastCue.start
        || (candidate.start === lastCue.start && candidate.end > lastCue.end)
      ) {
        lastCue = candidate;
      }
    }
  }

  return lastCue;
}

function isNegatedOccurrence(text: string, occurrence: { start: number; end: number }) {
  const clauseStart = Math.max(0, findLastClauseBoundaryIndex(text, occurrence.start));
  const clauseText = text.slice(clauseStart, occurrence.start);
  const negationCue = findLastNegationCue(clauseText);

  if (!negationCue) {
    return false;
  }

  const betweenCueAndOccurrence = clauseText.slice(negationCue.end).trim();
  if (!betweenCueAndOccurrence) {
    return true;
  }

  if (NEGATION_BLOCKING_REGEX.test(betweenCueAndOccurrence)) {
    return false;
  }

  return betweenCueAndOccurrence.split(/\s+/).filter(Boolean).length <= MAX_NEGATION_WORD_DISTANCE;
}

function hasNonNegatedPattern(text: string, pattern: string) {
  const occurrences = findPatternOccurrences(text, pattern);
  if (occurrences.length === 0) {
    return false;
  }

  return occurrences.some((occurrence) => !isNegatedOccurrence(text, occurrence));
}

function includesAnyNonNegated(text: string, patterns: readonly string[]) {
  if (!text) {
    return false;
  }

  return patterns.some((pattern) => hasNonNegatedPattern(text, pattern));
}

function findSymptomDefinitionForQuery(normalizedCondition: string) {
  if (!normalizedCondition) {
    return null;
  }

  return SYMPTOM_SIGNAL_DEFINITIONS.find((definition) => (
    definition.key === normalizedCondition
    || definition.patterns.some((pattern) => pattern === normalizedCondition)
  )) ?? null;
}

function extractSymptomSignals(text: string) {
  return SYMPTOM_SIGNAL_DEFINITIONS
    .filter((definition) => includesAnyNonNegated(text, definition.patterns))
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
  encounter: Pick<ParsedClinicalAnalyticsEncounter, 'probableConditions' | 'diagnosticConditions'> & { diagnoses?: EncounterDiagnosisEntry[] },
  source: ClinicalAnalyticsSource,
) {
  const probableConditions = encounter.probableConditions.length > 0
    ? encounter.probableConditions
    : (encounter.diagnoses ?? []).filter(
        (entry): entry is ClinicalConditionEntry => entry.source === 'AFECCION_PROBABLE',
      );

  const diagnosticConditions = encounter.diagnosticConditions.length > 0
    ? encounter.diagnosticConditions
    : (encounter.diagnoses ?? []).filter(
        (entry): entry is ClinicalConditionEntry => entry.source === 'SOSPECHA_DIAGNOSTICA',
      );

  if (source === 'AFECCION_PROBABLE') {
    return probableConditions;
  }

  if (source === 'SOSPECHA_DIAGNOSTICA') {
    return diagnosticConditions;
  }

  return uniqueBy([...probableConditions, ...diagnosticConditions], (entry) => `${entry.key}:${entry.code ?? ''}`);
}

export function matchesAnalyticsCondition(entries: ClinicalConditionEntry[], normalizedCondition: string) {
  if (!normalizedCondition) {
    return true;
  }

  return entries.some((entry) => entry.key.includes(normalizedCondition) || entry.code?.toLowerCase().includes(normalizedCondition));
}

export function matchesAnalyticsQuery(
  encounter: Pick<ParsedClinicalAnalyticsEncounter, 'probableConditions' | 'diagnosticConditions' | 'searchableText' | 'symptomSignals'> & { diagnoses?: EncounterDiagnosisEntry[] },
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

  const symptomDefinition = findSymptomDefinitionForQuery(normalizedCondition);
  if (symptomDefinition) {
    return includesAnyNonNegated(
      encounter.searchableText,
      uniqueBy([symptomDefinition.key, ...symptomDefinition.patterns], (value) => value),
    );
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
  const treatmentOutcomeFromSection = aggregateTreatmentOutcome(
    (respuesta.resultadosTratamientos || []).map((entry) => ({
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

  const associatedConditionLabels = uniqueBy(
    [...probableConditions, ...diagnosticConditions].map((entry) => entry.label.trim()),
    (label) => label,
  );

  const commonAssociatedConditions = associatedConditionLabels.length > 0 ? associatedConditionLabels : undefined;

  const medications = (tratamiento.medicamentosEstructurados || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      const linkedConditions = resolveAssociatedConditionLabels(
        entry.sospechaId,
        diagnosticConditionLabelById,
        commonAssociatedConditions,
      );
      const treatmentOutcome = (respuesta.resultadosTratamientos || []).find((item) => item.treatmentItemId === entry.id);

      return {
        key: normalizeConditionName(label),
        label,
        details: [entry.dosis, entry.via, entry.frecuencia, entry.duracion].filter(Boolean).join(' · ') || undefined,
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(treatmentOutcome?.adherenceStatus ? { adherenceStatus: treatmentOutcome.adherenceStatus } : {}),
        ...(treatmentOutcome?.adverseEventSeverity ? { adverseEventSeverity: treatmentOutcome.adverseEventSeverity } : {}),
        ...(treatmentOutcome?.adverseEventNotes ? { adverseEventNotes: treatmentOutcome.adverseEventNotes } : {}),
      };
    })
    .filter(isDefined);

  const exams = (tratamiento.examenesEstructurados || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      const linkedConditions = resolveAssociatedConditionLabels(
        entry.sospechaId,
        diagnosticConditionLabelById,
        commonAssociatedConditions,
      );
      const treatmentOutcome = (respuesta.resultadosTratamientos || []).find((item) => item.treatmentItemId === entry.id);

      return {
        key: normalizeConditionName(label),
        label,
        details: [entry.estado, entry.indicacion].filter(Boolean).join(' · ') || undefined,
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(treatmentOutcome?.adherenceStatus ? { adherenceStatus: treatmentOutcome.adherenceStatus } : {}),
        ...(treatmentOutcome?.adverseEventSeverity ? { adverseEventSeverity: treatmentOutcome.adverseEventSeverity } : {}),
        ...(treatmentOutcome?.adverseEventNotes ? { adverseEventNotes: treatmentOutcome.adverseEventNotes } : {}),
      };
    })
    .filter(isDefined);

  const referrals = (tratamiento.derivacionesEstructuradas || [])
    .map((entry) => {
      const label = entry.nombre?.trim();

      if (!label) {
        return null;
      }

      const linkedConditions = resolveAssociatedConditionLabels(
        entry.sospechaId,
        diagnosticConditionLabelById,
        commonAssociatedConditions,
      );
      const treatmentOutcome = (respuesta.resultadosTratamientos || []).find((item) => item.treatmentItemId === entry.id);

      return {
        key: normalizeConditionName(label),
        label,
        details: [entry.estado, entry.indicacion].filter(Boolean).join(' · ') || undefined,
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(treatmentOutcome?.adherenceStatus ? { adherenceStatus: treatmentOutcome.adherenceStatus } : {}),
        ...(treatmentOutcome?.adverseEventSeverity ? { adverseEventSeverity: treatmentOutcome.adverseEventSeverity } : {}),
        ...(treatmentOutcome?.adverseEventNotes ? { adverseEventNotes: treatmentOutcome.adverseEventNotes } : {}),
      };
    })
    .filter(isDefined);

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