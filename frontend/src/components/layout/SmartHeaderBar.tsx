'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import {
  FiClock,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiUsers,
  FiClipboard,
  FiSearch,
  FiPlus,
  FiBell,
  FiFileText,
} from 'react-icons/fi';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';

/* ─── Types ───────────────────────────────────────────────── */

interface DashboardCounts {
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

interface KpiChip {
  key: string;
  label: string;
  value: number | undefined;
  href: string;
  icon: React.ElementType;
  tone: string;
  alertTone?: string;
}

interface SmartHeaderBarProps {
  onSearchOpen: () => void;
}

/* ─── Route config ────────────────────────────────────────── */

const NON_CLINICAL_PREFIXES = ['/ajustes', '/admin', '/plantillas', '/catalogo'];

function getChipsForRoute(
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

function isChipActive(chip: KpiChip, pathname: string, searchParams: URLSearchParams): boolean {
  const chipUrl = new URL(chip.href, 'http://x');
  if (chipUrl.pathname !== pathname) return false;
  for (const [key, value] of chipUrl.searchParams.entries()) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

/* ─── Component ───────────────────────────────────────────── */

export default function SmartHeaderBar({ onSearchOpen }: SmartHeaderBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateEncounter, canCreatePatient } = useAuthStore();
  const isNonClinical = NON_CLINICAL_PREFIXES.some((p) => pathname.startsWith(p));

  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  // Close create dropdown on outside click
  useEffect(() => {
    if (!createOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [createOpen]);

  // ── Data queries ──────────────────────────────────────
  const { data, isLoading, isError } = useQuery<{ counts: DashboardCounts }>({
    queryKey: ['dashboard-header-kpis'],
    queryFn: async () => {
      const res = await api.get('/encounters/stats/dashboard');
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 2,
    enabled: !isNonClinical,
  });

  const { data: alertData } = useQuery<{ count: number }>({
    queryKey: ['alerts-unacknowledged-count'],
    queryFn: async () => {
      const res = await api.get('/alerts/unacknowledged-count');
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: 2,
    enabled: !isNonClinical,
  });

  if (isNonClinical) return null;

  const counts = data?.counts;
  const chips = getChipsForRoute(pathname, counts);
  const showSkeleton = isLoading && !counts;
  const alertCount = alertData?.count ?? 0;
  const showCreate = canCreateEncounter() || canCreatePatient();

  return (
    <div className="smart-header-bar" role="region" aria-label="Indicadores y acciones rápidas">
      {/* ── Left: contextual KPI chips ────────── */}

      {/* Mobile compact */}
      <div className="flex md:hidden items-center gap-2 flex-1 min-w-0 overflow-x-auto">
        {showSkeleton ? (
          <div className="h-5 w-32 skeleton rounded-lg" />
        ) : isError ? (
          <span className="text-xs text-ink-muted">Sin datos</span>
        ) : (
          chips.slice(0, 3).map((chip) => {
            const ChipIcon = chip.icon;
            const active = isChipActive(chip, pathname, searchParams);
            const tone = chip.alertTone || chip.tone;
            return (
              <Link
                key={chip.key}
                href={chip.href}
                className={clsx(
                  'smart-header-chip-mobile',
                  active && 'smart-header-chip-active',
                )}
              >
                <ChipIcon className={clsx('w-3.5 h-3.5', tone)} />
                <span className="font-bold">{chip.value ?? '—'}</span>
              </Link>
            );
          })
        )}
      </div>

      {/* Desktop KPI chips */}
      <div className="hidden md:flex items-center gap-2 flex-1 min-w-0 flex-wrap">
        {showSkeleton ? (
          <div className="h-7 w-48 skeleton rounded-pill" />
        ) : isError ? (
          <span className="text-sm text-ink-muted">Sin datos</span>
        ) : (
          chips.map((chip) => {
            const ChipIcon = chip.icon;
            const active = isChipActive(chip, pathname, searchParams);
            const tone = chip.alertTone || chip.tone;
            return (
              <Tooltip key={chip.key} label={chip.label} side="bottom">
                <Link
                  href={chip.href}
                  className={clsx(
                    'smart-header-chip',
                    active && 'smart-header-chip-active',
                  )}
                  aria-label={chip.label}
                  aria-current={active ? 'true' : undefined}
                >
                  <ChipIcon className={clsx('w-3.5 h-3.5', tone)} />
                  <span className="smart-header-chip-value">{chip.value ?? '—'}</span>
                  <span className="smart-header-chip-label">{chip.label}</span>
                </Link>
              </Tooltip>
            );
          })
        )}
      </div>

      {/* ── Right: actions ────────────────────── */}
      <div className="smart-header-actions">
        {/* Search trigger */}
        <Tooltip label="Buscar (⌘K)" side="bottom">
          <button
            onClick={onSearchOpen}
            className="smart-header-action-btn"
            aria-label="Buscar"
          >
            <FiSearch className="w-4 h-4" />
            <span className="hidden lg:inline text-xs text-ink-muted">⌘K</span>
          </button>
        </Tooltip>

        {/* Quick create */}
        {showCreate && (
          <div ref={createRef} className="relative">
            <Tooltip label="Crear nuevo" side="bottom">
              <button
                onClick={() => setCreateOpen(!createOpen)}
                className="smart-header-action-btn"
                aria-label="Crear nuevo"
                aria-expanded={createOpen}
              >
                <FiPlus className="w-4 h-4" />
              </button>
            </Tooltip>

            {createOpen && (
              <div className="smart-header-dropdown">
                {canCreateEncounter() && (
                  <Link
                    href="/atenciones/nueva"
                    className="smart-header-dropdown-item"
                    onClick={() => setCreateOpen(false)}
                  >
                    <FiFileText className="w-4 h-4 text-ink-secondary" />
                    Nueva atención
                  </Link>
                )}
                {canCreatePatient() && (
                  <Link
                    href="/pacientes/nuevo"
                    className="smart-header-dropdown-item"
                    onClick={() => setCreateOpen(false)}
                  >
                    <FiUsers className="w-4 h-4 text-ink-secondary" />
                    Nuevo paciente
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alert badge */}
        <Tooltip label={alertCount > 0 ? `${alertCount} alertas sin reconocer` : 'Sin alertas pendientes'} side="bottom">
          <div className="smart-header-action-btn relative" aria-label={`${alertCount} alertas sin reconocer`}>
            <FiBell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="smart-header-alert-badge">{alertCount > 99 ? '99+' : alertCount}</span>
            )}
          </div>
        </Tooltip>
      </div>
    </div>
  );
}
