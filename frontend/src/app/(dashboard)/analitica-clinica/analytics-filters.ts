import { todayLocalDateString } from '@/lib/date';

export type ClinicalAnalyticsFilterState = {
  condition: string;
  source: 'ANY' | 'AFECCION_PROBABLE' | 'SOSPECHA_DIAGNOSTICA';
  fromDate: string;
  toDate: string;
  followUpDays: string;
  limit: string;
};

export type AnalyticsCasesFocus = {
  type: 'MEDICATION' | 'SYMPTOM';
  value: string;
};

function relativeDateOnly(daysAgo: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(
    new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  );
}

export function resolveDefaultClinicalAnalyticsFilters(): ClinicalAnalyticsFilterState {
  const toDate = todayLocalDateString();
  const fromDate = relativeDateOnly(89);

  return {
    condition: '',
    source: 'ANY',
    fromDate,
    toDate,
    followUpDays: '30',
    limit: '10',
  };
}

export function resolveClinicalAnalyticsFiltersFromSearchParams(
  searchParams: URLSearchParams,
  defaults: ClinicalAnalyticsFilterState,
): ClinicalAnalyticsFilterState {
  return {
    condition: searchParams.get('condition') || defaults.condition,
    source: (searchParams.get('source') as ClinicalAnalyticsFilterState['source']) || defaults.source,
    fromDate: searchParams.get('fromDate') || defaults.fromDate,
    toDate: searchParams.get('toDate') || defaults.toDate,
    followUpDays: searchParams.get('followUpDays') || defaults.followUpDays,
    limit: searchParams.get('limit') || defaults.limit,
  };
}

export function buildClinicalAnalyticsSummaryUrl(filters: ClinicalAnalyticsFilterState) {
  const params = new URLSearchParams();
  if (filters.condition.trim()) params.set('condition', filters.condition.trim());
  params.set('source', filters.source);
  params.set('fromDate', filters.fromDate);
  params.set('toDate', filters.toDate);
  params.set('followUpDays', filters.followUpDays);
  params.set('limit', filters.limit);
  return `/analitica-clinica?${params}`;
}

export function buildClinicalAnalyticsCasesUrl(
  filters: ClinicalAnalyticsFilterState,
  focus?: AnalyticsCasesFocus,
  page?: number,
) {
  const params = new URLSearchParams();
  if (filters.condition.trim()) params.set('condition', filters.condition.trim());
  params.set('source', filters.source);
  params.set('fromDate', filters.fromDate);
  params.set('toDate', filters.toDate);
  params.set('followUpDays', filters.followUpDays);
  if (focus?.value.trim()) {
    params.set('focusType', focus.type);
    params.set('focusValue', focus.value.trim());
  }
  if (page && page > 1) {
    params.set('page', String(page));
  }
  return `/analitica-clinica/casos?${params}`;
}