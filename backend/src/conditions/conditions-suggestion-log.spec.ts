import {
  buildSuggestionLogMetadata,
  CONDITION_SUGGESTION_RANKING_VERSION,
} from './conditions-suggestion-log';

const suggestions = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Hipertensión arterial',
    score: 12,
    confidence: 95,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Cefalea tensional',
    score: 8,
    confidence: 64,
  },
];

describe('conditions-suggestion-log', () => {
  it('serializes manual decisions without chosen suggestion details', () => {
    expect(CONDITION_SUGGESTION_RANKING_VERSION).toBe('2026-04-name-synonyms-tags-v1');

    expect(JSON.parse(buildSuggestionLogMetadata(suggestions, null))).toEqual({
      suggestionCount: 2,
      topSuggestionId: suggestions[0].id,
      topSuggestionScore: 12,
      topSuggestionConfidence: 95,
      chosenSuggestionRank: null,
      chosenSuggestionScore: null,
      chosenSuggestionConfidence: null,
    });
  });

  it('serializes chosen suggestion rank and score for AUTO decisions', () => {
    expect(
      JSON.parse(buildSuggestionLogMetadata(suggestions, suggestions[1].id)),
    ).toEqual({
      suggestionCount: 2,
      topSuggestionId: suggestions[0].id,
      topSuggestionScore: 12,
      topSuggestionConfidence: 95,
      chosenSuggestionRank: 2,
      chosenSuggestionScore: 8,
      chosenSuggestionConfidence: 64,
    });
  });
});