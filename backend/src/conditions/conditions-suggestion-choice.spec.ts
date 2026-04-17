import { BadRequestException } from '@nestjs/common';
import {
  validateSuggestionChoicePayload,
  type SuggestionChoicePayload,
} from './conditions-suggestion-choice';

const baseSuggestion = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Migraña',
  score: 12,
  confidence: 95,
  reasons: [],
};

function buildPayload(
  overrides: Partial<SuggestionChoicePayload> = {},
): SuggestionChoicePayload {
  return {
    inputText: 'dolor de cabeza intenso',
    suggestions: [baseSuggestion],
    chosenConditionId: baseSuggestion.id,
    chosenMode: 'AUTO',
    ...overrides,
  };
}

describe('validateSuggestionChoicePayload', () => {
  it('accepts AUTO choices when chosenConditionId is present in suggestions', () => {
    expect(() => validateSuggestionChoicePayload(buildPayload())).not.toThrow();
  });

  it('rejects AUTO choices without chosenConditionId', () => {
    expect(() =>
      validateSuggestionChoicePayload(buildPayload({ chosenConditionId: null })),
    ).toThrow(BadRequestException);
  });

  it('rejects AUTO choices that point outside the provided suggestions', () => {
    expect(() =>
      validateSuggestionChoicePayload(
        buildPayload({ chosenConditionId: '22222222-2222-4222-8222-222222222222' }),
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts MANUAL choices only when chosenConditionId is null', () => {
    expect(() =>
      validateSuggestionChoicePayload(
        buildPayload({ chosenMode: 'MANUAL', chosenConditionId: null }),
      ),
    ).not.toThrow();
  });

  it('rejects MANUAL choices that still send chosenConditionId', () => {
    expect(() =>
      validateSuggestionChoicePayload(buildPayload({ chosenMode: 'MANUAL' })),
    ).toThrow(BadRequestException);
  });
});
