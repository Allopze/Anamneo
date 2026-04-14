import { parseStoredJson } from '../common/utils/encounter-sections';
import { formatEncounterSectionForRead } from '../common/utils/encounter-section-compat';

export const PDF_LOCALE = 'es-CL';
export const PDF_TIME_ZONE = 'America/Santiago';

export const SEXO_MAP: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMENINO: 'Femenino',
  OTRO: 'Otro',
  PREFIERE_NO_DECIR: 'Prefiere no decir',
};

export const PREVISION_MAP: Record<string, string> = {
  FONASA: 'FONASA',
  ISAPRE: 'ISAPRE',
  OTRA: 'Otra',
  DESCONOCIDA: 'Desconocida',
};

export function formatRutDisplay(data: { rut?: string | null; rutExempt?: boolean | null; rutExemptReason?: string | null }) {
  const rut = typeof data.rut === 'string' ? data.rut.trim() : '';
  if (rut) return rut;

  const rutExemptReason = typeof data.rutExemptReason === 'string' ? data.rutExemptReason.trim() : '';
  if (data.rutExempt && rutExemptReason) return `Sin RUT (${rutExemptReason})`;

  return 'Sin RUT';
}

export function formatSospechaDiagnosticaLabel(sospecha: Record<string, unknown>) {
  const diagnostico = typeof sospecha.diagnostico === 'string' ? sospecha.diagnostico.trim() : '';
  const codigoCie10 = typeof sospecha.codigoCie10 === 'string' ? sospecha.codigoCie10.trim() : '';
  const descripcionCie10 = typeof sospecha.descripcionCie10 === 'string' ? sospecha.descripcionCie10.trim() : '';

  const baseLabel = diagnostico || descripcionCie10 || 'Diagnóstico sin descripción';
  if (!codigoCie10) return baseLabel;
  if (descripcionCie10) return `${baseLabel} (${codigoCie10}: ${descripcionCie10})`;
  return `${baseLabel} (${codigoCie10})`;
}

export function buildSectionsMap(sections: Array<{ sectionKey: string; data: any; schemaVersion?: number | null }>) {
  const result: Record<string, any> = {};
  for (const section of sections) {
    const normalized = formatEncounterSectionForRead(section);
    result[section.sectionKey] = normalized.data || {};
  }
  return result;
}

export function getTreatmentPlanText(trat: Record<string, any>) {
  const plan = typeof trat.plan === 'string' ? trat.plan.trim() : '';
  const indicaciones = typeof trat.indicaciones === 'string' ? trat.indicaciones.trim() : '';
  if (!plan) return indicaciones;
  if (!indicaciones || indicaciones === plan) return plan;
  return `${plan}\n${indicaciones}`;
}

export function formatHistoryFieldText(value: unknown) {
  const parsed = parseStoredJson(value, value);
  if (!parsed) return '';

  if (typeof parsed === 'string') return parsed.trim();

  if (typeof parsed !== 'object' || Array.isArray(parsed)) return '';

  const record = parsed as Record<string, unknown>;
  const items = Array.isArray(record.items)
    ? record.items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const text = typeof record.texto === 'string' ? record.texto.trim() : '';

  if (!items.length) return text;
  if (!text) return items.join(', ');
  return `${items.join(', ')}. ${text}`;
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat(PDF_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PDF_TIME_ZONE,
  }).format(new Date(value));
}
