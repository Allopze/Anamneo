export type RankedMetricRow = {
  label: string;
  encounterCount: number;
  patientCount: number;
  badge?: string;
  subtitle?: string;
};

export type ScopedProblem = {
  patientId: string;
  label: string;
  resolvedAt: Date | null;
};

export type EncounterOutcomeEvaluation = {
  encounterId: string;
  hasReconsult: boolean;
  hasAdjustment: boolean;
  hasResolvedProblem: boolean;
  hasAlertAfterIndex: boolean;
  hasFavorableResponseProxy: boolean;
};
