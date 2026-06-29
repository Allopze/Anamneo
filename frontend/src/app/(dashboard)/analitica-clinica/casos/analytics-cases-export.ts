import { api } from '@/lib/api';
import { todayLocalDateString } from '@/lib/date';
import type { AnalyticsCasesFocus, ClinicalAnalyticsFilterState } from '../analytics-filters';

function getFilenameFromDisposition(value?: string) {
  if (!value) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const classicMatch = /filename="?([^"]+)"?/i.exec(value);
  return classicMatch?.[1] || null;
}

function buildFallbackFilename() {
  return `casos_analiticos_${todayLocalDateString()}.csv`;
}

export async function downloadClinicalAnalyticsCasesCsv(
  filters: ClinicalAnalyticsFilterState,
  focus?: AnalyticsCasesFocus,
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

  const response = await api.get(`/analytics/clinical/cases/export/csv?${params}`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getFilenameFromDisposition(
    response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'],
  ) || buildFallbackFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}