'use client';

import { useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FiSearch,
  FiLogOut,
  FiUser,
  FiFileText,
  FiArrowRight,
} from 'react-icons/fi';
import clsx from 'clsx';
import { getNameInitial } from '@/lib/utils';
import { AnamneoLogo } from '@/components/branding/AnamneoLogo';
import Tooltip from '@/components/common/Tooltip';
import type { SearchResult } from './useDashboardSearch';
import type { IconType } from 'react-icons';

export interface NavItem {
  name: string;
  href: string;
  icon: IconType;
  exact?: boolean;
}

interface DashboardSidebarProps {
  user: { nombre?: string; isAdmin?: boolean; role?: string } | null;
  primaryItems: NavItem[];
  secondaryItems: NavItem[];
  collapsed: boolean;
  isOperationalAdmin: boolean;
  searchQuery: string;
  searchOpen: boolean;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchActiveIndex: number;
  shortcutHint: string;
  showCollapseToggle: boolean;
  onCollapsedChange: (next: boolean) => void;
  onSearchChange: (value: string) => void;
  onSearchOpen: () => void;
  onSearchFocus: () => void;
  onSearchNavigate: (href: string) => void;
  onSearchActiveIndexChange: (index: number) => void;
  onSearchClose: () => void;
  onLogout: () => void;
  searchInputRef: React.Ref<HTMLInputElement>;
}

export default function DashboardSidebar({
  user,
  primaryItems,
  secondaryItems,
  collapsed,
  isOperationalAdmin,
  searchQuery,
  searchOpen,
  searchResults,
  searchLoading,
  searchActiveIndex,
  shortcutHint,
  showCollapseToggle,
  onCollapsedChange,
  onSearchChange,
  onSearchOpen,
  onSearchFocus,
  onSearchNavigate,
  onSearchActiveIndexChange,
  onSearchClose,
  onLogout,
  searchInputRef,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userRoleLabel = user?.isAdmin ? 'Administrador' : user?.role === 'MEDICO' ? 'Médico' : 'Asistente';

  useEffect(() => {
    if (!searchOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        onSearchClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen, onSearchClose]);

  useEffect(() => {
    if (collapsed && searchOpen) {
      onSearchClose();
    }
  }, [collapsed, searchOpen, onSearchClose]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onSearchClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onSearchActiveIndexChange(searchActiveIndex < searchResults.length - 1 ? searchActiveIndex + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onSearchActiveIndexChange(searchActiveIndex > 0 ? searchActiveIndex - 1 : searchResults.length - 1);
    } else if (e.key === 'Enter' && searchActiveIndex >= 0 && searchResults[searchActiveIndex]) {
      e.preventDefault();
      onSearchNavigate(searchResults[searchActiveIndex].href);
    }
  };

  return (
    <div className={clsx('relative hidden lg:flex flex-shrink-0 py-4 pr-3', showCollapseToggle ? 'pl-7' : 'pl-4')}>
      {showCollapseToggle ? (
        <SidebarCollapseButton collapsed={collapsed} onToggle={() => onCollapsedChange(!collapsed)} />
      ) : null}

      <aside
        className={clsx(
          'z-10 flex flex-col rounded-shell bg-frame shadow-elevated transition-[width] duration-200',
          collapsed ? 'w-[76px]' : 'w-[236px]',
        )}
        style={{ overflow: 'clip' }}
      >
        <div className={clsx('flex h-24 items-center', collapsed ? 'justify-center px-3' : 'px-7')}>
          <Link href="/" className="flex items-center" aria-label="Inicio — Anamneo">
            <AnamneoLogo
              className={clsx(collapsed ? 'justify-center gap-0' : 'gap-2')}
              iconClassName={clsx('brightness-0 invert', collapsed ? 'h-9 w-9' : 'h-8 w-8')}
              textClassName={clsx('text-2xl font-extrabold text-white tracking-tight', collapsed && 'hidden')}
            />
          </Link>
        </div>

        <div className={clsx('border-b border-white/20', collapsed ? 'mb-3 px-3 pb-4' : 'mb-4 px-4 pb-5')}>
          {collapsed ? (
            <Tooltip label={`${user?.nombre ?? 'Usuario'} · ${userRoleLabel}`} side="right">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface-inset text-base font-bold text-frame">
                {getNameInitial(user?.nombre)}
              </div>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 rounded-card bg-frame-dark p-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-surface-inset text-lg font-bold text-frame">
                {getNameInitial(user?.nombre)}
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-sm font-bold text-white" title={user?.nombre}>{user?.nombre}</p>
                <p className="truncate text-xs font-medium capitalize text-white/50">
                  {userRoleLabel}
                </p>
              </div>
            </div>
          )}
        </div>

        {!isOperationalAdmin ? (
          <div className={clsx(collapsed ? 'mb-3 px-3' : 'mb-3 px-4')} ref={searchContainerRef}>
            {collapsed ? (
              <Tooltip label={`Buscar (${shortcutHint})`} side="right">
                <button
                  type="button"
                  onClick={onSearchOpen}
                  className="mx-auto flex h-11 w-11 items-center justify-center rounded-card border border-white/[0.12] bg-white/[0.08] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
                  aria-label={`Buscar pacientes y atenciones (${shortcutHint})`}
                >
                  <FiSearch className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : (
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={onSearchFocus}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={`Buscar… ${shortcutHint}`}
                  role="combobox"
                  aria-expanded={searchOpen && !!searchQuery.trim()}
                  aria-controls="search-results-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={searchActiveIndex >= 0 && searchResults[searchActiveIndex] ? `search-result-${searchResults[searchActiveIndex].id}` : undefined}
                  aria-label="Buscar pacientes y atenciones"
                  className="w-full rounded-pill border border-white/[0.1] bg-white/[0.08] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-accent/50 focus:bg-white/[0.12]"
                />

                {searchOpen && searchQuery.trim() && (
                  <SearchResultsDropdown
                    results={searchResults}
                    loading={searchLoading}
                    query={searchQuery}
                    activeIndex={searchActiveIndex}
                    onNavigate={onSearchNavigate}
                    onActiveIndexChange={onSearchActiveIndexChange}
                  />
                )}
              </div>
            )}
          </div>
        ) : null}

        <nav
          className={clsx(
            'sidebar-scroll flex-1 overflow-y-auto',
            collapsed ? 'space-y-2 px-2 py-2' : 'space-y-1.5 px-4 py-2',
          )}
          aria-label="Navegación principal"
        >
          {primaryItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <SidebarNavItem key={item.name} item={item} isActive={isActive} collapsed={collapsed} />
            );
          })}

          <div className={clsx('border-t border-white/[0.12]', collapsed ? 'mx-1 my-2' : 'mx-2 my-3')} />

          {secondaryItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <SidebarNavItem key={item.name} item={item} isActive={isActive} collapsed={collapsed} />
            );
          })}
        </nav>

        <div className={clsx(collapsed ? 'p-3 pt-2' : 'p-6')}>
          {collapsed ? (
            <Tooltip label="Salir" side="right">
              <button
                onClick={onLogout}
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-card bg-frame-dark text-white/55 transition-colors hover:bg-status-red hover:text-white"
                aria-label="Salir"
              >
                <FiLogOut className="h-4.5 w-4.5" />
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={onLogout}
              className="flex w-full items-center justify-center rounded-pill bg-frame-dark px-4 py-3 text-sm font-bold text-white/50 transition-colors hover:bg-status-red hover:text-white"
            >
              <FiLogOut className="mr-3 h-5 w-5" />
              Salir
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function SidebarCollapseButton({
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

function SidebarNavItem({
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
      <Tooltip label={item.name} side="right">
        <div className="flex w-full justify-center">{link}</div>
      </Tooltip>
    );
  }

  return link;
}

function SearchResultsDropdown({
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
  const patients = useMemo(() => results.filter(r => r.type === 'patient'), [results]);
  const encounters = useMemo(() => results.filter(r => r.type === 'encounter'), [results]);

  return (
    <div id="search-results-listbox" role="listbox" aria-label="Resultados de búsqueda" className="absolute left-0 top-full mt-2 w-full bg-surface-elevated rounded-card shadow-dropdown border border-surface-muted/30 overflow-hidden z-50 animate-fade-in">
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="text-center py-6 text-ink-muted text-sm">
          Sin resultados para &ldquo;{query}&rdquo;
        </div>
      )}
      {!loading && results.length > 0 && (
        <div className="py-1.5 max-h-72 overflow-y-auto">
          {patients.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Pacientes</div>
              {patients.map((r) => {
                const flatIndex = results.indexOf(r);
                return (
                  <button key={r.id} id={`search-result-${r.id}`} role="option" aria-selected={flatIndex === activeIndex} onClick={() => onNavigate(r.href)} onMouseEnter={() => onActiveIndexChange(flatIndex)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${flatIndex === activeIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50'}`}>
                    <FiUser className="w-4 h-4 text-ink-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{r.title}</p>
                      <p className="text-micro text-ink-muted truncate">{r.subtitle}</p>
                    </div>
                    <FiArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {encounters.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Atenciones</div>
              {encounters.map((r) => {
                const flatIndex = results.indexOf(r);
                return (
                  <button key={r.id} id={`search-result-${r.id}`} role="option" aria-selected={flatIndex === activeIndex} onClick={() => onNavigate(r.href)} onMouseEnter={() => onActiveIndexChange(flatIndex)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${flatIndex === activeIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50'}`}>
                    <FiFileText className="w-4 h-4 text-ink-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-ink truncate">{r.title}</p>
                      <p className="text-micro text-ink-muted truncate">{r.subtitle}</p>
                    </div>
                    <FiArrowRight className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
