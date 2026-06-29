import { ConditionsTfIdf } from './conditions-tfidf';
import { ConditionInput, SuggestionReason, SuggestionResult } from './conditions-similarity.types';

export interface ConditionDocument {
  id: string;
  name: string;
  normalizedName: string;
  synonyms: Array<{ raw: string; normalized: string }>;
  tags: Array<{ raw: string; normalized: string }>;
}

export function buildDocument(condition: ConditionInput): ConditionDocument {
  return {
    id: condition.id,
    name: condition.name,
    normalizedName: normalizeText(condition.name),
    synonyms: (condition.synonyms ?? [])
      .map((term) => ({ raw: term, normalized: normalizeText(term) }))
      .filter((entry) => Boolean(entry.normalized)),
    tags: (condition.tags ?? [])
      .map((term) => ({ raw: term, normalized: normalizeText(term) }))
      .filter((entry) => Boolean(entry.normalized)),
  };
}

export function buildWeightedSearchText(document: ConditionDocument) {
  return [
    document.normalizedName,
    document.normalizedName,
    ...document.synonyms.map((entry) => entry.normalized),
    ...document.synonyms.map((entry) => entry.normalized),
    ...document.tags.map((entry) => entry.normalized),
  ].join(' ');
}

export function rankDocuments(
  tfidf: ConditionsTfIdf,
  documents: ConditionDocument[],
  inputText: string,
  limit: number,
): Promise<SuggestionResult[]> {
  const normalizedInput = normalizeText(inputText);
  if (!normalizedInput) {
    return Promise.resolve([]);
  }

  const inputTokens = tokenize(normalizedInput);
  const scores = documents
    .map((document, index) => ({
      document,
      score: scoreDocument(tfidf, index, document, normalizedInput, inputTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const maxScore = scores[0]?.score || 1;

  return Promise.resolve(
    scores.map(({ document, score }) => ({
      id: document.id,
      name: document.name,
      score,
      confidence: Math.max(1, Math.min(Math.round((score / maxScore) * 100), 99)),
      reasons: buildSuggestionReasons(document, normalizedInput, inputTokens),
    })),
  );
}

function scoreDocument(
  tfidf: ConditionsTfIdf,
  index: number,
  document: ConditionDocument,
  normalizedInput: string,
  inputTokens: string[],
) {
  let score = tfidf.scoreDocument(index, normalizedInput);

  score += scoreTerm(document.normalizedName, normalizedInput, inputTokens, {
    exact: 10,
    contains: 5,
    overlap: 4,
    allTokens: 3,
  });
  score += scoreBestTerm(
    document.synonyms.map((entry) => entry.normalized),
    normalizedInput,
    inputTokens,
    {
      exact: 8,
      contains: 4,
      overlap: 3,
      allTokens: 2,
    },
  );
  score += scoreBestTerm(
    document.tags.map((entry) => entry.normalized),
    normalizedInput,
    inputTokens,
    {
      exact: 4,
      contains: 2,
      overlap: 1.5,
      allTokens: 1,
    },
  );

  return score;
}

function buildSuggestionReasons(
  document: ConditionDocument,
  normalizedInput: string,
  inputTokens: string[],
) {
  const reasons: SuggestionReason[] = [];
  const nameReason = buildReason('NAME', 'Nombre', document.name, document.normalizedName, normalizedInput, inputTokens);
  if (nameReason) {
    reasons.push(nameReason);
  }

  const synonymReason = buildBestEntryReason(
    document.synonyms,
    'SYNONYM',
    'Sinónimo',
    normalizedInput,
    inputTokens,
  );
  if (synonymReason) {
    reasons.push(synonymReason);
  }

  const tagReason = buildBestEntryReason(document.tags, 'TAG', 'Tag', normalizedInput, inputTokens);
  if (tagReason) {
    reasons.push(tagReason);
  }

  return reasons;
}

function buildBestEntryReason(
  entries: Array<{ raw: string; normalized: string }>,
  kind: SuggestionReason['kind'],
  label: string,
  normalizedInput: string,
  inputTokens: string[],
) {
  const bestEntry = entries
    .map((entry) => ({
      entry,
      score: scoreTerm(entry.normalized, normalizedInput, inputTokens, {
        exact: 1,
        contains: 1,
        overlap: 1,
        allTokens: 1,
      }),
    }))
    .sort((left, right) => right.score - left.score)[0];

  if (!bestEntry || bestEntry.score <= 0) {
    return null;
  }

  return buildReason(kind, label, bestEntry.entry.raw, bestEntry.entry.normalized, normalizedInput, inputTokens);
}

function buildReason(
  kind: SuggestionReason['kind'],
  label: string,
  rawValue: string,
  normalizedTerm: string,
  normalizedInput: string,
  inputTokens: string[],
) {
  const termTokens = tokenize(normalizedTerm);
  const matches = [...new Set(inputTokens.filter((token) => termTokens.includes(token)))];

  if (
    matches.length === 0
    && normalizedTerm !== normalizedInput
    && !normalizedTerm.includes(normalizedInput)
    && !normalizedInput.includes(normalizedTerm)
  ) {
    return null;
  }

  return {
    kind,
    label,
    matchedValue: rawValue,
    matches,
  } satisfies SuggestionReason;
}

function scoreBestTerm(
  terms: string[],
  normalizedInput: string,
  inputTokens: string[],
  weights: { exact: number; contains: number; overlap: number; allTokens: number },
) {
  return terms.reduce(
    (bestScore, term) => Math.max(bestScore, scoreTerm(term, normalizedInput, inputTokens, weights)),
    0,
  );
}

function scoreTerm(
  term: string,
  normalizedInput: string,
  inputTokens: string[],
  weights: { exact: number; contains: number; overlap: number; allTokens: number },
) {
  if (!term) {
    return 0;
  }

  const termTokens = tokenize(term);
  let score = 0;

  if (term === normalizedInput) {
    score += weights.exact;
  } else if (term.includes(normalizedInput) || normalizedInput.includes(term)) {
    score += weights.contains;
  }

  const sharedTokens = inputTokens.filter((token) => termTokens.includes(token)).length;
  if (sharedTokens > 0) {
    score += (sharedTokens / Math.max(inputTokens.length, termTokens.length)) * weights.overlap;
  }

  if (inputTokens.length > 1 && inputTokens.every((token) => termTokens.includes(token))) {
    score += weights.allTokens;
  }

  return score;
}

function tokenize(text: string) {
  return text.split(/\s+/).filter(Boolean);
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
