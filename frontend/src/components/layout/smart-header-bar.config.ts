import {
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
  FiClipboard,
} from 'react-icons/fi';

/* ─── Types ───────────────────────────────────────────────── */

export interface DashboardCounts {
  enProgreso: number;
  completado: number;
  cancelado: number;
  total: number;
  pendingReview: number;
  upcomingTasks: number;
  overdueTasks: number;
  patientIncomplete: number;
  patientPendingVerification: number;
  patientVerified: number;
  patientNonVerified: number;
}

export interface KpiChip {
  key: string;
  label: string;
  value: number | undefined;
  href: string;
  icon: React.ElementType;
  tone: string;
  alertTone?: string;
}

export interface AlertSummary {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
  patient: { id: string; nombre: string };
}

/* ─── Constants ───────────────────────────────────────────── */

export const SEVERITY_STYLE: Record<string, string> = {
  CRITICA: 'bg-status-red/20 text-status-red-text',
  ALTA: 'bg-status-red/10 text-status-red-text',
  MEDIA: 'bg-status-yellow/40 text-accent-text',
  BAJA: 'bg-surface-muted text-ink-secondary',
};

export const SEVERITY_LABEL: Record<string, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

export const NON_CLINICAL_PREFIXES = ['/ajustes', '/admin', '/plantillas', '/catalogo'];

/* ─── Route config ────────────────────────────────────────── */

export function getChipsForRoute(
  pathname: string,
  counts: DashboardCounts | undefined,
): KpiChip[] {
  if (!counts) return [];

  if (pathname === '/') {
    return [
      {
        key: 'activas',
        label: 'Atenciones activas',
        value: counts.enProgreso,
        href: '/atenciones?status=EN_PROGRESO',
        icon: FiClock,
        tone: 'text-accent-text',
      },
      {
        key: 'pendientes-rev',
        label: 'Pendientes de revisión',
        value: counts.pendingReview,
        href: '/atenciones?reviewStatus=LISTA_PARA_REVISION',
        icon: FiAlertTriangle,
        tone: 'text-ink-secondary',
        alertTone: counts.pendingReview > 0 ? 'text-status-red-text' : undefined,
      },
      {
        key: 'vencidas',
        label: 'Tareas vencidas',
        value: counts.overdueTasks,
        href: '/seguimientos?overdueOnly=true',
        icon: FiClipboard,
        tone: 'text-ink-secondary',
        alertTone: counts.overdueTasks > 0 ? 'text-status-red-text' : undefined,
      },
    ];
  }

  if (pathname === '/atenciones') {
    return [
      {
        key: 'en-progreso',
        label: 'En progreso',
        value: counts.enProgreso,
        href: '/atenciones?status=EN_PROGRESO',
        icon: FiClock,
        tone: 'text-accent-text',
      },
      {
        key: 'completadas',
        label: 'Completadas',
        value: counts.completado,
        href: '/atenciones?status=COMPLETADO',
        icon: FiCheckCircle,
        tone: 'text-status-green-text',
      },
      {
        key: 'canceladas',
        label: 'Canceladas',
        value: counts.cancelado,
        href: '/atenciones?status=CANCELADO',
        icon: FiXCircle,
        tone: 'text-ink-muted',
      },
      {
        key: 'pendientes-rev',
        label: 'Pendientes revisión',
        value: counts.pendingReview,
        href: '/atenciones?reviewStatus=LISTA_PARA_REVISION',
        icon: FiAlertTriangle,
        tone: 'text-ink-secondary',
        alertTone: counts.pendingReview > 0 ? 'text-status-red-text' : undefined,
      },
    ];
  }

  if (pathname === '/pacientes') {
    return [
      {
        key: 'incompletas',
        label: 'Fichas incompletas',
        value: counts.patientIncomplete,
        href: '/pacientes?completenessStatus=INCOMPLETA',
        icon: FiUsers,
        tone: 'text-accent-text',
      },
      {
        key: 'pend-verif',
        label: 'Pendientes verificación',
        value: counts.patientPendingVerification,
        href: '/pacientes?completenessStatus=PENDIENTE_VERIFICACION',
        icon: FiAlertTriangle,
        tone: 'text-ink-secondary',
        alertTone: counts.patientPendingVerification > 0 ? 'text-status-red-text' : undefined,
      },
      {
        key: 'verificadas',
        label: 'Verificadas',
        value: counts.patientVerified,
        href: '/pacientes?completenessStatus=VERIFICADA',
        icon: FiCheckCircle,
        tone: 'text-status-green-text',
      },
    ];
  }

  if (pathname === '/seguimientos') {
    return [
      {
        key: 'pendientes',
        label: 'Pendientes',
        value: counts.upcomingTasks,
        href: '/seguimientos?status=PENDIENTE',
        icon: FiClipboard,
        tone: 'text-accent-text',
      },
      {
        key: 'vencidas',
        label: 'Vencidas',
        value: counts.overdueTasks,
        href: '/seguimientos?overdueOnly=true',
        icon: FiAlertTriangle,
        tone: 'text-ink-secondary',
        alertTone: counts.overdueTasks > 0 ? 'text-status-red-text' : undefined,
      },
    ];
  }

  // Fallback: abbreviated global KPIs
  return [
    {
      key: 'activas',
      label: 'Activas',
      value: counts.enProgreso,
      href: '/atenciones?status=EN_PROGRESO',
      icon: FiClock,
      tone: 'text-accent-text',
    },
    {
      key: 'pendientes',
      label: 'Pendientes',
      value: counts.pendingReview,
      href: '/atenciones?reviewStatus=LISTA_PARA_REVISION',
      icon: FiAlertTriangle,
      tone: 'text-ink-secondary',
      alertTone: counts.pendingReview > 0 ? 'text-status-red-text' : undefined,
    },
    {
      key: 'completadas',
      label: 'Completadas',
      value: counts.completado,
      href: '/atenciones?status=COMPLETADO',
      icon: FiCheckCircle,
      tone: 'text-status-green-text',
    },
  ];
}

export function isChipActive(chip: KpiChip, pathname: string, searchParams: URLSearchParams): boolean {
  const chipUrl = new URL(chip.href, 'http://x');
  if (chipUrl.pathname !== pathname) return false;
  for (const [key, value] of chipUrl.searchParams.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}
