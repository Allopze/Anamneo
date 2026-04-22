'use client';

import { useEffect, useRef } from 'react';
import { FiSearch } from 'react-icons/fi';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';
import type { SearchResult } from './useDashboardSearch';
import { SearchResultsDropdown } from './DashboardSidebarParts';

export function DashboardSidebarSearch({
  collapsed,
  shortcutHint,
  searchQuery,
  searchOpen,
  searchResults,
  searchLoading,
  searchActiveIndex,
  onSearchChange,
  onSearchOpen,
  onSearchFocus,
  onSearchNavigate,
  onSearchActiveIndexChange,
  onSearchClose,
  searchInputRef,
}: {
  collapsed: boolean;
  shortcutHint: string;
  searchQuery: string;
  searchOpen: boolean;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchActiveIndex: number;
  onSearchChange: (value: string) => void;
  onSearchOpen: () => void;
  onSearchFocus: () => void;
  onSearchNavigate: (href: string) => void;
  onSearchActiveIndexChange: (index: number) => void;
  onSearchClose: () => void;
  searchInputRef: React.Ref<HTMLInputElement>;
}) {
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
    <div className={clsx(collapsed ? 'mb-3 px-3' : 'mb-3 px-4')} ref={searchContainerRef}>
      {collapsed ? (
        <div className="flex justify-center">
          <Tooltip label={`Buscar (${shortcutHint})`} side="right">
            <button
              type="button"
              onClick={onSearchOpen}
              className="flex h-11 w-11 items-center justify-center rounded-card border border-white/[0.12] bg-white/[0.08] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
              aria-label={`Buscar pacientes y atenciones (${shortcutHint})`}
            >
              <FiSearch className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
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

          {searchOpen && searchQuery.trim() ? (
            <SearchResultsDropdown
              results={searchResults}
              loading={searchLoading}
              query={searchQuery}
              activeIndex={searchActiveIndex}
              onNavigate={onSearchNavigate}
              onActiveIndexChange={onSearchActiveIndexChange}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}