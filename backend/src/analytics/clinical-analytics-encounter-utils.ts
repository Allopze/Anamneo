import type { EncounterOutcomeEntry } from './clinical-analytics-encounter';

export function aggregateAdherenceStatus(values: Array<string | null | undefined>) {
  const filtered = values.filter(Boolean) as string[];
  if (filtered.includes('NO_ADHERENTE')) {
    return 'NO_ADHERENTE' as const;
  }
  if (filtered.includes('PARCIAL')) {
    return 'PARCIAL' as const;
  }
  if (filtered.includes('ADHERENTE')) {
    return 'ADHERENTE' as const;
  }
  return undefined;
}

export function aggregateAdverseEventSeverity(values: Array<string | null | undefined>) {
  const filtered = values.filter(Boolean) as string[];
  if (filtered.includes('SEVERO')) {
    return 'SEVERO' as const;
  }
  if (filtered.includes('MODERADO')) {
    return 'MODERADO' as const;
  }
  if (filtered.includes('LEVE')) {
    return 'LEVE' as const;
  }
  return undefined;
}

export function resolveAssociatedConditionLabels(
  sospechaId: string | undefined,
  diagnosisLabelById: Map<string, string>,
  fallback?: string[],
) {
  const normalizedId = sospechaId?.trim();
  if (!normalizedId) {
    return fallback;
  }

  const diagnosisLabel = diagnosisLabelById.get(normalizedId);
  if (!diagnosisLabel) {
    return fallback;
  }

  return [diagnosisLabel];
}

export function aggregateTreatmentOutcome(
  outcomes: Array<{
    outcomeStatus: string;
    outcomeSource: string;
    notes?: string | null;
    adherenceStatus?: string | null;
    adverseEventSeverity?: string | null;
    adverseEventNotes?: string | null;
  }> | undefined,
): EncounterOutcomeEntry | null {
  if (!outcomes || outcomes.length === 0) {
    return null;
  }

  const normalized = outcomes.map((outcome) => ({
    status: outcome.outcomeStatus,
    source: outcome.outcomeSource,
    notes: outcome.notes ?? undefined,
    adherenceStatus: outcome.adherenceStatus ?? undefined,
    adverseEventSeverity: outcome.adverseEventSeverity ?? undefined,
    adverseEventNotes: outcome.adverseEventNotes ?? undefined,
  }));

  const notes = normalized.map((item) => item.notes).filter(Boolean).join(' \n') || undefined;
  const adverseEventNotes = normalized.map((item) => item.adverseEventNotes).filter(Boolean).join(' \n') || undefined;
  const source = normalized[0].source as EncounterOutcomeEntry['source'];
  const adherenceStatus = aggregateAdherenceStatus(normalized.map((item) => item.adherenceStatus));
  const adverseEventSeverity = aggregateAdverseEventSeverity(normalized.map((item) => item.adverseEventSeverity));

  if (normalized.some((item) => item.status === 'FAVORABLE')) {
    return { status: 'FAVORABLE', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
  }

  if (normalized.some((item) => item.status === 'SIN_RESPUESTA' || item.status === 'EMPEORA')) {
    return { status: 'SIN_RESPUESTA', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
  }

  if (normalized.some((item) => item.status === 'PARCIAL')) {
    return { status: 'PARCIAL', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
  }

  return { status: 'UNKNOWN', source, notes, adherenceStatus, adverseEventSeverity, adverseEventNotes };
}

export function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = getKey(value);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

export function resolveStructuredResponse(respuestaEstructurada: {
  estado?: string;
} | undefined) {
  if (!respuestaEstructurada?.estado) {
    return null;
  }

  return {
    favorable: respuestaEstructurada.estado === 'FAVORABLE',
    unfavorable: respuestaEstructurada.estado === 'SIN_RESPUESTA' || respuestaEstructurada.estado === 'EMPEORA',
  };
}

export function buildPersistedTreatmentEntries(
  treatments: Array<{
    treatmentType: 'MEDICATION' | 'EXAM' | 'REFERRAL';
    label: string;
    normalizedLabel: string;
    details?: string | null;
    dose?: string | null;
    route?: string | null;
    frequency?: string | null;
    duration?: string | null;
    indication?: string | null;
    status?: string | null;
    diagnosis?: { label?: string | null; normalizedLabel?: string | null } | null;
    outcomes?: Array<{
      outcomeStatus: string;
      outcomeSource: string;
      notes?: string | null;
      adherenceStatus?: string | null;
      adverseEventSeverity?: string | null;
      adverseEventNotes?: string | null;
    }> | null;
  }> | undefined,
  treatmentType: 'MEDICATION' | 'EXAM' | 'REFERRAL',
  associatedConditionLabels: string[] | undefined,
) {
  return (treatments ?? [])
    .filter((entry) => entry.treatmentType === treatmentType)
    .map((entry) => {
      const linkedConditions = entry.diagnosis?.label?.trim()
        ? [entry.diagnosis.label.trim()]
        : associatedConditionLabels;
      const aggregatedOutcome = aggregateTreatmentOutcome(entry.outcomes ?? undefined);

      return {
        key: entry.normalizedLabel,
        label: entry.label,
        details: entry.details ?? undefined,
        ...(linkedConditions ? { associatedConditionLabels: linkedConditions } : {}),
        ...(aggregatedOutcome?.adherenceStatus ? { adherenceStatus: aggregatedOutcome.adherenceStatus } : {}),
        ...(aggregatedOutcome?.adverseEventSeverity ? { adverseEventSeverity: aggregatedOutcome.adverseEventSeverity } : {}),
        ...(aggregatedOutcome?.adverseEventNotes ? { adverseEventNotes: aggregatedOutcome.adverseEventNotes } : {}),
      };
    });
}
