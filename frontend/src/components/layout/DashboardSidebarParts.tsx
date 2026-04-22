'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { FiArrowRight, FiFileText, FiUser } from 'react-icons/fi';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';
import type { NavItem } from './DashboardSidebar';
import type { SearchResult } from './useDashboardSearch';

export function SidebarNavItem({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const link = (
    <Link
      href={item.href}
      aria-label={item.name}
      title={collapsed ? item.name : undefined}
      className={clsx(
        'transition-all',
        collapsed
          ? isActive
            ? 'flex h-11 w-11 items-center justify-center rounded-card bg-accent text-accent-text shadow-soft'
            : 'flex h-11 w-11 items-center justify-center rounded-card text-white/55 hover:bg-frame-dark hover:text-white'
          : isActive
            ? 'flex w-full items-center rounded-pill bg-accent px-4 py-3.5 text-sm font-bold text-accent-text'
            : 'flex w-full items-center rounded-pill px-4 py-3.5 text-sm font-bold text-white/50 hover:bg-frame-dark hover:text-white',
      )}
    >
      <span className={clsx(collapsed ? 'flex h-5 w-5 items-center justify-center' : 'mr-4 flex h-5 w-5 items-center justify-center')}>
        <item.icon className={clsx('h-5 w-5', isActive ? 'text-accent-text' : 'text-white/40')} />
      </span>
      {!collapsed ? item.name : null}
    </Link>
  );

  if (collapsed) {
    return (
      <div className="flex w-full justify-center">
        <Tooltip label={item.name} side="right">
          {link}
        </Tooltip>
      </div>
    );
  }

  return link;
}

export function SearchResultsDropdown({
  results,
  loading,
  query,
  activeIndex,
  onNavigate,
  onActiveIndexChange,
}: {
  results: SearchResult[];
  loading: boolean;
  query: string;
  activeIndex: number;
  onNavigate: (href: string) => void;
  onActiveIndexChange: (index: number) => void;
}) {
  const patients = useMemo(() => results.filter((r) => r.type === 'patient'), [results]);
  const encounters = useMemo(() => results.filter((r) => r.type === 'encounter'), [results]);

  return (
    <div id="search-results-listbox" role="listbox" aria-label="Resultados de búsqueda" className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-card border border-surface-muted/30 bg-surface-elevated shadow-dropdown animate-fade-in">
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : null}
      {!loading && results.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-ink-muted">
          Sin resultados para &ldquo;{query}&rdquo;
        </div>
      ) : null}
      {!loading && results.length > 0 ? (
        <div className="max-h-72 overflow-y-auto py-1.5">
          {patients.length > 0 ? (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Pacientes</div>
              {patients.map((result) => {
                const flatIndex = results.indexOf(result);
                return (
                  <button
                    key={result.id}
                    id={`search-result-${result.id}`}
                    role="option"
                    aria-selected={flatIndex === activeIndex}
                    onClick={() => onNavigate(result.href)}
                    onMouseEnter={() => onActiveIndexChange(flatIndex)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      flatIndex === activeIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50',
                    )}
                  >
                    <FiUser className="h-4 w-4 shrink-0 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{result.title}</p>
                      <p className="truncate text-micro text-ink-muted">{result.subtitle}</p>
                    </div>
                    <FiArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  </button>
                );
              })}
            </div>
          ) : null}
          {encounters.length > 0 ? (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Atenciones</div>
              {encounters.map((result) => {
                const flatIndex = results.indexOf(result);
                return (
                  <button
                    key={result.id}
                    id={`search-result-${result.id}`}
                    role="option"
                    aria-selected={flatIndex === activeIndex}
                    onClick={() => onNavigate(result.href)}
                    onMouseEnter={() => onActiveIndexChange(flatIndex)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      flatIndex === activeIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50',
                    )}
                  >
                    <FiFileText className="h-4 w-4 shrink-0 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{result.title}</p>
                      <p className="truncate text-micro text-ink-muted">{result.subtitle}</p>
                    </div>
                    <FiArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SidebarCollapseButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'} side="right">
      <button
        type="button"
        onClick={onToggle}
        className="absolute left-0 top-10 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-surface-muted/35 bg-surface-elevated text-ink-secondary shadow-soft transition-colors hover:border-frame/18 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20"
        aria-label={collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <span className="text-base leading-none">»</span> : <span className="text-base leading-none">«</span>}
      </button>
    </Tooltip>
  );
}