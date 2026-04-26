'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import {
  FiSearch,
  FiPlus,
  FiFileText,
  FiUsers,
  FiTag,
} from 'react-icons/fi';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';
import AlertPopover from './AlertPopover';
import {
  type DashboardCounts,
  type KpiChip,
  NON_CLINICAL_PREFIXES,
  getChipsForRoute,
  isChipActive,
} from './smart-header-bar.config';

interface SmartHeaderBarProps {
  onSearchOpen: () => void;
  contextSlot?: React.ReactNode;
  className?: string;
}

/* ─── Component ───────────────────────────────────────────── */

export default function SmartHeaderBar({ onSearchOpen, contextSlot, className }: SmartHeaderBarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canCreateEncounter, canCreatePatient } = useAuthStore();
  const isCatalogRoute = pathname.startsWith('/catalogo');
  const isNonClinical = NON_CLINICAL_PREFIXES.some((p) => pathname.startsWith(p));
  const shouldHideHeader = isNonClinical && !isCatalogRoute;

  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);
  const createItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  // Platform-aware shortcut hint
  const shortcutHint = useMemo(() => {
    if (typeof navigator === 'undefined') return '⌘K';
    return /mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl+K';
  }, []);

  // Close create dropdown on outside click or Escape
  useEffect(() => {
    if (!createOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCreateOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [createOpen]);

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
    enabled: !shouldHideHeader && !isCatalogRoute,
  });

  const { data: catalogConditions, isLoading: isCatalogCountLoading } = useQuery<Array<{ id: string }>>({
    queryKey: ['conditions', ''],
    queryFn: async () => {
      const response = await api.get('/conditions');
      return response.data as Array<{ id: string }>;
    },
    staleTime: 60_000,
    enabled: isCatalogRoute,
  });

  if (shouldHideHeader) return null;

  const counts = data?.counts;
  const chips: KpiChip[] = isCatalogRoute
    ? [
        {
          key: 'afecciones',
          label: 'Afecciones',
          value: catalogConditions?.length,
          href: '/catalogo',
          icon: FiTag,
          tone: 'text-accent-text',
        },
      ]
    : getChipsForRoute(pathname, counts);
  const showSkeleton = isCatalogRoute ? isCatalogCountLoading && !catalogConditions : isLoading && !counts;
  const showCreate = canCreateEncounter() || canCreatePatient();

  return (
    <div className={clsx('smart-header-bar', className)} role="region" aria-label="Indicadores y acciones rápidas">
      {/* ── Left: contextual KPI chips ────────── */}

      {/* Mobile compact */}
      <div
        className={clsx(
          'flex md:hidden items-center gap-2 min-w-0 overflow-x-auto',
          contextSlot ? 'flex-none' : 'flex-1',
        )}
      >
        {showSkeleton ? (
          <div className="h-5 w-32 skeleton rounded-lg" />
        ) : isError && !isCatalogRoute ? (
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
      <div
        className={clsx(
          'hidden md:flex items-center gap-2 min-w-0 flex-wrap',
          contextSlot ? 'flex-none' : 'flex-1',
        )}
      >
        {showSkeleton ? (
          <div className="h-7 w-48 skeleton rounded-pill" />
        ) : isError && !isCatalogRoute ? (
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
        <AlertPopover isNonClinical={isNonClinical} />
      </div>
    </div>
  );
}
