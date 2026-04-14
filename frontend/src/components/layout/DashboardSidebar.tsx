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
  isOperationalAdmin: boolean;
  searchQuery: string;
  searchOpen: boolean;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchActiveIndex: number;
  shortcutHint: string;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  onSearchNavigate: (href: string) => void;
  onSearchActiveIndexChange: (index: number) => void;
  onSearchClose: () => void;
  onLogout: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function DashboardSidebar({
  user,
  primaryItems,
  secondaryItems,
  isOperationalAdmin,
  searchQuery,
  searchOpen,
  searchResults,
  searchLoading,
  searchActiveIndex,
  shortcutHint,
  onSearchChange,
  onSearchFocus,
  onSearchNavigate,
  onSearchActiveIndexChange,
  onSearchClose,
  onLogout,
  searchInputRef,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
    <aside className="hidden lg:flex flex-col w-64 bg-frame m-4 rounded-shell shadow-elevated z-10 flex-shrink-0" style={{ overflow: 'clip' }}>
      {/* Logo */}
      <div className="h-24 flex items-center px-8">
        <Link href="/" className="flex items-center gap-2" aria-label="Inicio — Anamneo">
          <AnamneoLogo
            className="gap-2"
            iconClassName="h-8 w-8 brightness-0 invert"
            textClassName="text-2xl font-extrabold text-white tracking-tight"
          />
        </Link>
      </div>

      {/* User card */}
      <div className="px-4 pb-5 mb-4 border-b border-white/20">
        <div className="flex items-center gap-3 bg-frame-dark p-3 rounded-card">
          <div className="h-12 w-12 rounded-full bg-surface-inset flex items-center justify-center font-bold text-frame text-lg flex-shrink-0">
            {getNameInitial(user?.nombre)}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-sm font-bold text-white truncate" title={user?.nombre}>{user?.nombre}</p>
            <p className="text-xs text-white/50 font-medium capitalize truncate">
              {user?.isAdmin ? 'Administrador' : user?.role === 'MEDICO' ? 'Médico' : 'Asistente'}
            </p>
          </div>
        </div>
      </div>

      {/* Search (inside sidebar) */}
      {!isOperationalAdmin ? (
        <div className="px-4 mb-3" ref={searchContainerRef}>
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
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
              className="w-full bg-white/[0.08] text-white placeholder:text-white/30 text-sm rounded-pill pl-10 pr-4 py-2.5 outline-none border border-white/[0.1] focus:border-accent/50 focus:bg-white/[0.12] transition-colors"
            />

            {/* Search results dropdown */}
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
        </div>
      ) : null}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-1.5 overflow-y-auto sidebar-scroll" aria-label="Navegación principal">
        {primaryItems.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-pill transition-all',
                isActive
                  ? 'bg-accent text-accent-text'
                  : 'text-white/50 hover:bg-frame-dark hover:text-white'
              )}
            >
              <item.icon className={clsx('mr-4 h-5 w-5', isActive ? 'text-accent-text' : 'text-white/40')} />
              {item.name}
            </Link>
          );
        })}

        {/* Divider */}
        <div className="my-3 mx-2 border-t border-white/[0.12]" />

        {secondaryItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-pill transition-all',
                isActive
                  ? 'bg-accent text-accent-text'
                  : 'text-white/50 hover:bg-frame-dark hover:text-white'
              )}
            >
              <item.icon className={clsx('mr-4 h-5 w-5', isActive ? 'text-accent-text' : 'text-white/40')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-6">
        <button
          onClick={onLogout}
          className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-white/50 bg-frame-dark hover:text-white hover:bg-status-red rounded-pill transition-colors"
        >
          <FiLogOut className="mr-3 h-5 w-5" />
          Salir
        </button>
      </div>
    </aside>
  );
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
