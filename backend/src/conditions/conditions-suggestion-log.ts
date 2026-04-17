import type { SuggestionResult } from './conditions-similarity.service';

export const CONDITION_SUGGESTION_RANKING_VERSION = '2026-04-name-synonyms-tags-v1';

interface SuggestionLogMetadata {
  suggestionCount: number;
  topSuggestionId: string | null;
  topSuggestionScore: number | null;
  topSuggestionConfidence: number | null;
  topSuggestionReasons: SuggestionResult['reasons'];
  chosenSuggestionRank: number | null;
  chosenSuggestionScore: number | null;
  chosenSuggestionConfidence: number | null;
  chosenSuggestionReasons: SuggestionResult['reasons'];
}

export function buildSuggestionLogMetadata(
  suggestions: SuggestionResult[],
  chosenConditionId: string | null,
) {
  const topSuggestion = suggestions[0] ?? null;
  const chosenSuggestionIndex = chosenConditionId
    ? suggestions.findIndex((suggestion) => suggestion.id === chosenConditionId)
    : -1;
  const chosenSuggestion = chosenSuggestionIndex >= 0 ? suggestions[chosenSuggestionIndex] : null;

  const metadata: SuggestionLogMetadata = {
    suggestionCount: suggestions.length,
    topSuggestionId: topSuggestion?.id ?? null,
    topSuggestionScore: topSuggestion?.score ?? null,
    topSuggestionConfidence: topSuggestion?.confidence ?? null,
    topSuggestionReasons: topSuggestion?.reasons ?? [],
    chosenSuggestionRank: chosenSuggestionIndex >= 0 ? chosenSuggestionIndex + 1 : null,
    chosenSuggestionScore: chosenSuggestion?.score ?? null,
    chosenSuggestionConfidence: chosenSuggestion?.confidence ?? null,
    chosenSuggestionReasons: chosenSuggestion?.reasons ?? [],
  };

  return JSON.stringify(metadata);
}
