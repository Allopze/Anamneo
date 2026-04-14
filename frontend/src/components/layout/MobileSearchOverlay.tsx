'use client';

import { useMemo } from 'react';
import { FiSearch, FiX, FiUser, FiFileText, FiArrowRight } from 'react-icons/fi';
import type { SearchResult } from './useDashboardSearch';

interface MobileSearchOverlayProps {
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchActiveIndex: number;
  inputRef: React.Ref<HTMLInputElement>;
  onSearchChange: (value: string) => void;
  onSearchNavigate: (href: string) => void;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
}

export default function MobileSearchOverlay({
  searchQuery,
  searchResults,
  searchLoading,
  searchActiveIndex,
  inputRef,
  onSearchChange,
  onSearchNavigate,
  onActiveIndexChange,
  onClose,
}: MobileSearchOverlayProps) {
  const patients = useMemo(() => searchResults.filter(r => r.type === 'patient'), [searchResults]);
  const encounters = useMemo(() => searchResults.filter(r => r.type === 'encounter'), [searchResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onActiveIndexChange(searchActiveIndex < searchResults.length - 1 ? searchActiveIndex + 1 : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onActiveIndexChange(searchActiveIndex > 0 ? searchActiveIndex - 1 : searchResults.length - 1);
    } else if (e.key === 'Enter' && searchActiveIndex >= 0 && searchResults[searchActiveIndex]) {
      e.preventDefault();
      onSearchNavigate(searchResults[searchActiveIndex].href);
    }
  };

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-sm animate-fade-in">
      <div className="mx-4 mt-4 rounded-card bg-surface-elevated shadow-dropdown border border-surface-muted/30 overflow-hidden">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar pacientes y atenciones…"
            className="w-full text-ink pl-10 pr-12 py-4 outline-none text-sm bg-transparent"
            autoFocus
          />
          <button
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-input text-ink-muted hover:text-ink"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
        {searchQuery.trim() && (
          <div className="border-t border-surface-muted/30 max-h-[60vh] overflow-y-auto">
            {searchLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent" />
              </div>
            )}
            {!searchLoading && searchResults.length === 0 && (
              <div className="text-center py-8 text-ink-muted text-sm">
                Sin resultados para &ldquo;{searchQuery}&rdquo;
              </div>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div className="py-1.5">
                {patients.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Pacientes</div>
                    {patients.map((r) => {
                      const flatIndex = searchResults.indexOf(r);
                      return (
                        <button key={r.id} onClick={() => onSearchNavigate(r.href)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${flatIndex === searchActiveIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50'}`}>
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
                    <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Atenciones</div>
                    {encounters.map((r) => {
                      const flatIndex = searchResults.indexOf(r);
                      return (
                        <button key={r.id} onClick={() => onSearchNavigate(r.href)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${flatIndex === searchActiveIndex ? 'bg-surface-inset/70' : 'hover:bg-surface-inset/50'}`}>
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
        )}
      </div>
    </div>
  );
}
