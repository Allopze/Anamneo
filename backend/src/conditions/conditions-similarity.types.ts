export interface SuggestionReason {
  kind: 'NAME' | 'SYNONYM' | 'TAG';
  label: string;
  matchedValue: string;
  matches: string[];
}

export interface SuggestionResult {
  id: string;
  name: string;
  score: number;
  confidence: number;
  reasons?: SuggestionReason[];
}

export interface ConditionInput {
  id: string;
  name: string;
  synonyms?: string[];
  tags?: string[];
}
