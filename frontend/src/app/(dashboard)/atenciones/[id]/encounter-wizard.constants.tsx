import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { MEDICO_ONLY_SECTION_KEYS } from '../../../../../../shared/encounter-section-policy';
import type { SectionKey } from '@/types';

// ─── Dynamic section component map ──────────────────────────────

const SectionLoadingFallback = () => (
  <div className="rounded-card border border-surface-muted/40 bg-surface-base/55 px-5 py-5 text-sm text-ink-secondary">
    Cargando sección…
  </div>
);

export const SECTION_COMPONENTS: Record<SectionKey, ComponentType<any>> = {
  IDENTIFICACION: dynamic(() => import('@/components/sections/IdentificacionSection'), {
    loading: SectionLoadingFallback,
  }),
  MOTIVO_CONSULTA: dynamic(() => import('@/components/sections/MotivoConsultaSection'), {
    loading: SectionLoadingFallback,
  }),
  ANAMNESIS_PROXIMA: dynamic(() => import('@/components/sections/AnamnesisProximaSection'), {
    loading: SectionLoadingFallback,
  }),
  ANAMNESIS_REMOTA: dynamic(() => import('@/components/sections/AnamnesisRemotaSection'), {
    loading: SectionLoadingFallback,
  }),
  REVISION_SISTEMAS: dynamic(() => import('@/components/sections/RevisionSistemasSection'), {
    loading: SectionLoadingFallback,
  }),
  EXAMEN_FISICO: dynamic(() => import('@/components/sections/ExamenFisicoSection'), {
    loading: SectionLoadingFallback,
  }),
  SOSPECHA_DIAGNOSTICA: dynamic(() => import('@/components/sections/SospechaDiagnosticaSection'), {
    loading: SectionLoadingFallback,
  }),
  TRATAMIENTO: dynamic(() => import('@/components/sections/TratamientoSection'), {
    loading: SectionLoadingFallback,
  }),
  RESPUESTA_TRATAMIENTO: dynamic(() => import('@/components/sections/RespuestaTratamientoSection'), {
    loading: SectionLoadingFallback,
  }),
  OBSERVACIONES: dynamic(() => import('@/components/sections/ObservacionesSection'), {
    loading: SectionLoadingFallback,
  }),
};

// ─── Timing ─────────────────────────────────────────────────────

export const AUTOSAVE_DELAY = 10000; // 10 seconds

// ─── Types ──────────────────────────────────────────────────────

export type CompleteEncounterPayload = { closureNote: string };

export type SaveSectionResponse = {
  id: string;
  encounterId: string;
  sectionKey: SectionKey;
  completed: boolean;
  notApplicable: boolean;
  notApplicableReason: string | null;
  updatedAt: string;
  data: Record<string, any>;
  schemaVersion: number;
  warnings?: string[];
};

// ─── Label maps / constants ─────────────────────────────────────

export const LINKABLE_ATTACHMENT_LABELS = {
  EXAMEN: 'Examen',
  DERIVACION: 'Derivación',
} as const;

export const MEDICO_ONLY_SECTIONS: SectionKey[] = [...MEDICO_ONLY_SECTION_KEYS];

export const TEMPLATE_FIELD_BY_SECTION: Partial<Record<SectionKey, string>> = {
  MOTIVO_CONSULTA: 'texto',
  ANAMNESIS_PROXIMA: 'relatoAmpliado',
  TRATAMIENTO: 'plan',
  RESPUESTA_TRATAMIENTO: 'evolucion',
  OBSERVACIONES: 'observaciones',
};

export const REQUIRED_SEMANTIC_SECTIONS: SectionKey[] = [
  'MOTIVO_CONSULTA',
  'EXAMEN_FISICO',
  'SOSPECHA_DIAGNOSTICA',
  'TRATAMIENTO',
];

// ─── Section status UI ──────────────────────────────────────────

export const SECTION_STATUS_META = {
  idle: {
    label: '',
    badgeClassName: 'text-ink-secondary',
    dotClassName: 'bg-surface-muted',
    hidden: true,
  },
  dirty: {
    label: 'Pendiente',
    badgeClassName: 'text-accent-text',
    dotClassName: 'bg-status-yellow',
  },
  saving: {
    label: 'Guardando…',
    badgeClassName: 'text-ink',
    dotClassName: 'bg-frame',
  },
  saved: {
    label: 'Guardada',
    badgeClassName: 'text-status-green-text',
    dotClassName: 'bg-status-green',
  },
  completed: {
    label: 'Completa',
    badgeClassName: 'text-status-green-text',
    dotClassName: 'bg-status-green',
  },
  notApplicable: {
    label: 'No aplica',
    badgeClassName: 'text-ink-secondary',
    dotClassName: 'bg-surface-muted',
  },
  error: {
    label: 'Error',
    badgeClassName: 'text-status-red-text',
    dotClassName: 'bg-status-red',
  },
} as const;

export type SectionUiState = keyof typeof SECTION_STATUS_META;

// ─── CSS class tokens ───────────────────────────────────────────

export const SURFACE_PANEL_CLASS = 'overflow-hidden rounded-lg border border-frame/10 bg-surface-elevated';

export const INNER_PANEL_CLASS = 'rounded-lg border border-surface-muted/45 bg-surface-base/55';

export const RAIL_PANEL_CLASS = 'w-full overflow-hidden border border-frame/10 bg-surface-elevated/90';

export const WORKSPACE_STICKY_OFFSET_CLASS = 'top-[170px]';

// ─── Formatters ─────────────────────────────────────────────────

const headerDateFormatter = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const compactDateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatDateTime = (value?: string | null) => (value ? headerDateFormatter.format(new Date(value)) : '—');

export const formatCompactDate = (value?: string | null) =>
  value ? compactDateFormatter.format(new Date(value)) : '—';

export const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes)) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

// ─── Helpers ────────────────────────────────────────────────────

export const buildIdentificationSnapshotFromPatient = (encounter: { patient?: any }) => ({
  nombre: encounter.patient?.nombre || '',
  rut: encounter.patient?.rut || '',
  rutExempt: encounter.patient?.rutExempt || false,
  rutExemptReason: encounter.patient?.rutExemptReason || '',
  edad: encounter.patient?.edad,
  edadMeses: encounter.patient?.edadMeses ?? null,
  sexo: encounter.patient?.sexo || '',
  prevision: encounter.patient?.prevision || '',
  trabajo: encounter.patient?.trabajo || '',
  domicilio: encounter.patient?.domicilio || '',
});
