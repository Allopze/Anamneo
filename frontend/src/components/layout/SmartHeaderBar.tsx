'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  FiArrowRight,
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
  contextSlot?: React.ReactNode;
}

interface AlertSummary {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
  patient: { id: string; nombre: string };
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICA: 'bg-status-red/20 text-status-red-text',
  ALTA: 'bg-status-red/10 text-status-red-text',
  MEDIA: 'bg-status-yellow/40 text-accent-text',
  BAJA: 'bg-surface-muted text-ink-secondary',
};

const SEVERITY_LABEL: Record<string, string> = {
  CRITICA: 'Crítica',
  ALTA: 'Alta',
  MEDIA: 'Media',
  BAJA: 'Baja',
};

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

export default function SmartHeaderBar({ onSearchOpen, contextSlot }: SmartHeaderBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateEncounter, canCreatePatient } = useAuthStore();
  const isNonClinical = NON_CLINICAL_PREFIXES.some((p) => pathname.startsWith(p));

  const [createOpen, setCreateOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const createItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const alertItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  // Platform-aware shortcut hint
  const shortcutHint = useMemo(() => {
    if (typeof navigator === 'undefined') return '⌘K';
    return /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl+K';
  }, []);

  // Close dropdowns on outside click or Escape
  useEffect(() => {
    if (!createOpen && !alertOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (createOpen && createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
      if (alertOpen && alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setAlertOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateOpen(false);
        setAlertOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [createOpen, alertOpen]);

  // Arrow key navigation helper for dropdown menus
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent, itemsRef: React.MutableRefObject<(HTMLAnchorElement | null)[]>) => {
      const items = itemsRef.current.filter(Boolean) as HTMLAnchorElement[];
      if (!items.length) return;
      const idx = items.indexOf(e.target as HTMLAnchorElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
      }
    },
    [],
  );

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

  const { data: alertData, isError: isAlertError } = useQuery<{ count: number }>({
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

  const { data: alertListData, isLoading: isAlertListLoading } = useQuery<{ data: AlertSummary[] }>({
    queryKey: ['alerts-unacknowledged-list'],
    queryFn: async () => {
      const res = await api.get('/alerts/unacknowledged');
      return res.data;
    },
    staleTime: 60_000,
    retry: 2,
    enabled: alertOpen,
  });

  if (isNonClinical) return null;

  const counts = data?.counts;
  const chips = getChipsForRoute(pathname, counts);
  const showSkeleton = isLoading && !counts;
  const alertCount = isAlertError ? null : (alertData?.count ?? 0);
  const showCreate = canCreateEncounter() || canCreatePatient();
  const alertLabel = alertCount === null
    ? 'Error al cargar alertas'
    : alertCount > 0
      ? `${alertCount} alertas sin reconocer`
      : 'Sin alertas pendientes';

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
                title={chip.label}
                aria-label={chip.label}
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

      {contextSlot ? (
        <div className="smart-header-context-slot">
          {contextSlot}
        </div>
      ) : null}

      {/* ── Right: actions ────────────────────── */}
      <div className="smart-header-actions">
        {/* Search trigger */}
        <Tooltip label={`Buscar (${shortcutHint})`} side="bottom">
          <button
            onClick={onSearchOpen}
            className="smart-header-action-btn"
            aria-label="Buscar"
          >
            <FiSearch className="w-4 h-4" />
            <span className="hidden lg:inline text-xs text-ink-muted">{shortcutHint}</span>
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
                aria-haspopup="menu"
              >
                <FiPlus className="w-4 h-4" />
              </button>
            </Tooltip>

            {createOpen && (
              <div
                className="smart-header-dropdown"
                role="menu"
                aria-label="Crear nuevo"
                onKeyDown={(e) => handleMenuKeyDown(e, createItemsRef)}
              >
                {canCreateEncounter() && (
                  <Link
                    ref={(el) => { createItemsRef.current[0] = el; }}
                    href="/atenciones/nueva"
                    className="smart-header-dropdown-item"
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => setCreateOpen(false)}
                  >
                    <FiFileText className="w-4 h-4 text-ink-secondary" />
                    Nueva atención
                  </Link>
                )}
                {canCreatePatient() && (
                  <Link
                    ref={(el) => { createItemsRef.current[1] = el; }}
                    href="/pacientes/nuevo"
                    className="smart-header-dropdown-item"
                    role="menuitem"
                    tabIndex={0}
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

        {/* Alert badge + popover */}
        <div ref={alertRef} className="relative">
          <Tooltip label={alertLabel} side="bottom">
            <button
              type="button"
              className="smart-header-action-btn relative"
              aria-label={alertLabel}
              aria-expanded={alertOpen}
              aria-haspopup="true"
              onClick={() => setAlertOpen(!alertOpen)}
            >
              <FiBell className={clsx('w-4 h-4', isAlertError && 'text-ink-muted')} />
              {alertCount !== null && alertCount > 0 && (
                <span className="smart-header-alert-badge">{alertCount > 99 ? '99+' : alertCount}</span>
              )}
            </button>
          </Tooltip>

          {alertOpen && (
            <div
              className="smart-header-alert-popover"
              role="region"
              aria-label="Alertas sin reconocer"
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06]">
                <span className="text-sm font-bold text-ink">Alertas</span>
                {alertCount !== null && alertCount > 0 && (
                  <span className="text-xs font-medium text-ink-muted">{alertCount} pendientes</span>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto">
                {isAlertListLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-12 skeleton rounded-card" />
                    ))}
                  </div>
                ) : isAlertError ? (
                  <div className="p-4 text-sm text-ink-muted text-center">Error al cargar alertas</div>
                ) : !alertListData?.data?.length ? (
                  <div className="p-4 text-sm text-ink-muted text-center">Sin alertas pendientes</div>
                ) : (
                  <div
                    className="py-1"
                    onKeyDown={(e) => handleMenuKeyDown(e, alertItemsRef)}
                  >
                    {alertListData.data.map((alert, i) => (
                      <Link
                        key={alert.id}
                        ref={(el) => { alertItemsRef.current[i] = el; }}
                        href={`/pacientes/${alert.patient.id}`}
                        className="smart-header-alert-item"
                        tabIndex={0}
                        onClick={() => setAlertOpen(false)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={clsx(
                            'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                            SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE.MEDIA,
                          )}>
                            {SEVERITY_LABEL[alert.severity] || alert.severity}
                          </span>
                          <span className="truncate text-sm font-medium text-ink">{alert.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-ink-muted truncate">{alert.patient.nombre}</span>
                          <FiArrowRight className="w-3 h-3 text-ink-muted shrink-0" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
