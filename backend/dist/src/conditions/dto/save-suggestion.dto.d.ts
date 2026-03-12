declare class SuggestionItem {
    id: string;
    name: string;
    score: number;
    confidence: number;
}
export declare class SaveSuggestionDto {
    inputText: string;
    suggestions: SuggestionItem[];
    chosenConditionId: string | null;
    chosenMode: 'AUTO' | 'MANUAL';
}
export {};
