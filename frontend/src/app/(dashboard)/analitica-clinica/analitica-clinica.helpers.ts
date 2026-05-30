/**
 * Types and pure helpers for analitica-clinica/page.tsx.
 */

export type RankedRow = {
  label: string;
  encounterCount: number;
  patientCount: number;
  badge?: string;
  subtitle?: string;
};

export type ClinicalAnalyticsResponse = {
  filters: {
    condition: string | null;
    source: 'ANY' | 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
    fromDate: string;
    toDate: string;
    followUpDays: number;
    limit: number;
  };
  caveats: string[];
  privacy?: {
    smallCohortSuppressed: boolean;
    smallCohortThreshold: number;
  };
  summary: {
    matchedPatients: number;
    matchedEncounters: number;
    structuredTreatmentCount: number;
    structuredTreatmentCoverage: number;
    reconsultWithinWindowCount: number;
    reconsultWithinWindowRate: number;
    treatmentAdjustmentCount: number;
    treatmentAdjustmentRate: number;
    resolvedProblemCount: number;
    resolvedProblemRate: number;
    alertAfterIndexCount: number;
    alertAfterIndexRate: number;
    adherenceDocumentedCount: number;
    adherenceDocumentedRate: number;
    adverseEventCount: number;
    adverseEventRate: number;
    demographics: {
      averageAge: number | null;
      bySex: Record<string, number>;
    };
  };
  topConditions: RankedRow[];
  cohortBreakdown: {
    associatedSymptoms: RankedRow[];
    foodRelation: RankedRow[];
  };
  treatmentPatterns: {
    medications: RankedRow[];
    exams: RankedRow[];
    referrals: RankedRow[];
  };
  treatmentOutcomeProxies: {
    medications: Array<{
      label: string;
      patientCount: number;
      encounterCount: number;
      favorableCount: number;
      favorableRate: number;
      adjustmentCount: number;
      reconsultCount: number;
      adherenceCount: number;
      adverseEventCount: number;
      subtitle?: string;
    }>;
    exams: Array<{
      label: string;
      patientCount: number;
      encounterCount: number;
      favorableCount: number;
      favorableRate: number;
      adjustmentCount: number;
      reconsultCount: number;
      adherenceCount: number;
      adverseEventCount: number;
      subtitle?: string;
    }>;
    referrals: Array<{
      label: string;
      patientCount: number;
      encounterCount: number;
      favorableCount: number;
      favorableRate: number;
      adjustmentCount: number;
      reconsultCount: number;
      adherenceCount: number;
      adverseEventCount: number;
      subtitle?: string;
    }>;
  };
};

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
