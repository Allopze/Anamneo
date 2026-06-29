import { BadRequestException } from '@nestjs/common';
import type { SuggestionResult } from './conditions-similarity.service';

export interface SuggestionChoicePayload {
  inputText: string;
  suggestions: SuggestionResult[];
  chosenConditionId: string | null;
  chosenMode: 'AUTO' | 'MANUAL';
}

export function validateSuggestionChoicePayload(payload: SuggestionChoicePayload) {
  if (payload.chosenMode === 'AUTO') {
    if (!payload.chosenConditionId) {
      throw new BadRequestException('Una selección AUTO requiere chosenConditionId');
    }

    if (payload.suggestions.length === 0) {
      throw new BadRequestException('Una selección AUTO requiere una lista de sugerencias');
    }

    const selectedSuggestion = payload.suggestions.find(
      (suggestion) => suggestion.id === payload.chosenConditionId,
    );
    if (!selectedSuggestion) {
      throw new BadRequestException(
        'chosenConditionId debe existir dentro del arreglo de sugerencias enviado',
      );
    }

    return;
  }

  if (payload.chosenConditionId !== null) {
    throw new BadRequestException('Una selección MANUAL no debe enviar chosenConditionId');
  }
}