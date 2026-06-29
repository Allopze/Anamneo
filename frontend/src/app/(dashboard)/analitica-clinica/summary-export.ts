import { api } from '@/lib/api';
import { todayLocalDateString } from '@/lib/date';
import type { ClinicalAnalyticsFilterState } from './analytics-filters';

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
  return `resumen_analitica_clinica_${todayLocalDateString()}.csv`;
}

export async function downloadClinicalAnalyticsSummaryCsv(filters: ClinicalAnalyticsFilterState) {
  const params = new URLSearchParams();
  if (filters.condition.trim()) params.set('condition', filters.condition.trim());
  params.set('source', filters.source);
  params.set('fromDate', filters.fromDate);
  params.set('toDate', filters.toDate);
  params.set('followUpDays', filters.followUpDays);
  params.set('limit', filters.limit);

  const response = await api.get(`/analytics/clinical/summary/export/csv?${params}`, { responseType: 'blob' });
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

function buildMarkdownFilename() {
  return `reporte_analitica_clinica_${todayLocalDateString()}.md`;
}

export async function downloadClinicalAnalyticsSummaryMarkdown(filters: ClinicalAnalyticsFilterState) {
  const params = new URLSearchParams();
  if (filters.condition.trim()) params.set('condition', filters.condition.trim());
  params.set('source', filters.source);
  params.set('fromDate', filters.fromDate);
  params.set('toDate', filters.toDate);
  params.set('followUpDays', filters.followUpDays);
  params.set('limit', filters.limit);

  const response = await api.get(`/analytics/clinical/summary/export/md?${params}`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'text/markdown;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getFilenameFromDisposition(
    response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'],
  ) || buildMarkdownFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}