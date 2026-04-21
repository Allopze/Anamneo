import { normalizeConditionName } from '../conditions/conditions-helpers';

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

type PatternOccurrence = { start: number; end: number };

type StructuredAbdominalProfile = {
  presente?: boolean;
  vomitos?: boolean;
  diarrea?: boolean;
  nauseas?: boolean;
  estrenimiento?: boolean;
  asociadoComida?: 'SI' | 'NO' | 'NO_CLARO';
  notas?: string;
};

export type FoodRelation = 'ASSOCIATED' | 'NOT_ASSOCIATED' | 'UNSPECIFIED';

export type ClinicalSymptomSignal = {
  key: string;
  label: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function includesAny(text: string, patterns: readonly string[]) {
  if (!text) {
    return false;
  }

  return patterns.some((pattern) => text.includes(pattern));
}

export function normalizeClinicalText(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return normalizeConditionName(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPatternOccurrences(text: string, pattern: string) {
  const regex = new RegExp(`\\b${escapeRegExp(pattern)}\\b`, 'g');
  const matches: PatternOccurrence[] = [];

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
  let lastCue: PatternOccurrence | null = null;

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

function isNegatedOccurrence(text: string, occurrence: PatternOccurrence) {
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

export function includesAnyNonNegated(text: string, patterns: readonly string[]) {
  if (!text) {
    return false;
  }

  return patterns.some((pattern) => hasNonNegatedPattern(text, pattern));
}

export function findSymptomDefinitionForQuery(normalizedCondition: string) {
  if (!normalizedCondition) {
    return null;
  }

  return SYMPTOM_SIGNAL_DEFINITIONS.find((definition) => (
    definition.key === normalizedCondition
    || definition.patterns.some((pattern) => pattern === normalizedCondition)
  )) ?? null;
}

export function extractSymptomSignals(text: string): ClinicalSymptomSignal[] {
  return SYMPTOM_SIGNAL_DEFINITIONS
    .filter((definition) => includesAnyNonNegated(text, definition.patterns))
    .map((definition) => ({ key: definition.key, label: definition.label }));
}

export function extractStructuredSymptomSignals(
  perfilDolorAbdominal: StructuredAbdominalProfile | undefined,
): ClinicalSymptomSignal[] {
  if (!perfilDolorAbdominal) {
    return [];
  }

  return [
    perfilDolorAbdominal.presente ? { key: 'dolor abdominal', label: 'Dolor abdominal' } : null,
    perfilDolorAbdominal.vomitos ? { key: 'vomitos', label: 'Vómitos' } : null,
    perfilDolorAbdominal.diarrea ? { key: 'diarrea', label: 'Diarrea' } : null,
    perfilDolorAbdominal.nauseas ? { key: 'nauseas', label: 'Náuseas' } : null,
    perfilDolorAbdominal.estrenimiento ? { key: 'estrenimiento', label: 'Estreñimiento' } : null,
  ].filter((value): value is ClinicalSymptomSignal => value !== null);
}

export function classifyFoodRelation(text: string): FoodRelation {
  if (includesAny(text, FOOD_NOT_ASSOCIATED_PATTERNS)) {
    return 'NOT_ASSOCIATED';
  }

  if (includesAny(text, FOOD_ASSOCIATED_PATTERNS)) {
    return 'ASSOCIATED';
  }

  return 'UNSPECIFIED';
}

export function classifyStructuredFoodRelation(value: StructuredAbdominalProfile['asociadoComida']): FoodRelation {
  if (value === 'SI') {
    return 'ASSOCIATED';
  }

  if (value === 'NO') {
    return 'NOT_ASSOCIATED';
  }

  return 'UNSPECIFIED';
}
