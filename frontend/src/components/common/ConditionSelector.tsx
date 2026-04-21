'use client';

import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiPlus, FiX, FiTag } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import { Condition } from '@/types';
import { parseJsonArray } from '@/lib/safe-json';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface Props {
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  label?: string;
  allowCatalogPersistence?: boolean;
}

export default function ConditionSelector({
  selected,
  onChange,
  placeholder,
  label,
  allowCatalogPersistence = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Condition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isPersistingToCatalog, setIsPersistingToCatalog] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await api.get(`/conditions?search=${encodeURIComponent(query)}`);
        // Filter out already selected
        const results = (response.data as Condition[]).filter(
          (c) => !selected.includes(c.name)
        );
        setSuggestions(results);
      } catch (error) {
        console.error('Error fetching conditions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [query, selected]);

  const handleAdd = async (name: string, options?: { persistToCatalog?: boolean }) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    if (!selected.includes(trimmedName)) {
      onChange([...selected, trimmedName]);
    }

    if (options?.persistToCatalog) {
      setIsPersistingToCatalog(true);
      try {
        const response = await api.post('/conditions/local', { name: trimmedName });
        if (response.data?.deduplicatedByName) {
          toast.success('Afección reutilizada desde el catálogo local');
        } else {
          toast.success('Afección agregada al catálogo local');
        }
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsPersistingToCatalog(false);
      }
    }

    setQuery('');
    setIsOpen(false);
  };

  const handleRemove = (name: string) => {
    onChange(selected.filter((s) => s !== name));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      void handleAdd(query.trim());
    }
  };

  const trimmedQuery = query.trim();
  const hasExactSuggestion = suggestions.some(
    (suggestion) => suggestion.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );

  return (
    <div className="space-y-3" ref={wrapperRef}>
      <div className="rounded-card border border-surface-muted/35 bg-surface-base/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          {label ? <label className="form-label mb-0">{label}</label> : <span className="text-sm font-medium text-ink">Catálogo</span>}
          <span className="text-xs font-medium text-ink-muted">
            {selected.length} {selected.length === 1 ? 'selección' : 'selecciones'}
          </span>
        </div>

        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Buscar afección del catálogo...'}
            className="form-input pl-10"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 rounded-full border-2 border-frame/35 border-t-frame-dark animate-spin" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-surface-muted/45 bg-surface-inset px-2.5 py-1 text-sm font-medium text-ink animate-fade-in"
          >
            <FiTag className="h-3 w-3 text-ink-muted" />
            {item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="rounded-full p-0.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <FiX className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      {isOpen && (trimmedQuery || suggestions.length > 0) && (
        <div className="relative">
          <div className="absolute z-50 mt-0 w-full dropdown-surface max-h-64 overflow-y-auto">
            {suggestions.length > 0 && (
              <div className="dropdown-header py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sugerencias</p>
              </div>
            )}
            {suggestions.map((condition) => (
              <button
                type="button"
                key={condition.id}
                onClick={() => {
                  void handleAdd(condition.name);
                }}
                className="dropdown-item justify-between py-3"
              >
                <div>
                  <p className="font-medium text-ink-primary">{condition.name}</p>
                  {condition.tags?.length > 0 && (
                    <div className="mt-0.5 flex gap-1">
                      {parseJsonArray(condition.tags).map((tag: string) => (
                        <span key={tag} className="rounded bg-surface-muted px-1 text-[10px] text-ink-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <FiPlus className="h-4 w-4 text-ink-muted" />
              </button>
            ))}

            {trimmedQuery && !hasExactSuggestion && (
              <div className="border-t border-surface-muted/30 bg-surface-base/50">
                <button
                  type="button"
                  onClick={() => {
                    void handleAdd(trimmedQuery);
                  }}
                  className="dropdown-item py-3 text-ink"
                >
                  <FiPlus className="h-4 w-4" />
                  <span>Agregar solo al historial: <strong>"{trimmedQuery}"</strong></span>
                </button>
                {allowCatalogPersistence && (
                  <button
                    type="button"
                    onClick={() => {
                      void handleAdd(trimmedQuery, { persistToCatalog: true });
                    }}
                    disabled={isPersistingToCatalog}
                    className={clsx(
                      'dropdown-item py-3 text-ink',
                      isPersistingToCatalog && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <FiPlus className="h-4 w-4" />
                    <span>
                      {isPersistingToCatalog
                        ? 'Guardando en catálogo local...'
                        : `Agregar también al catálogo local: "${trimmedQuery}"`}
                    </span>
                  </button>
                )}
              </div>
            )}

            {!isLoading && trimmedQuery && suggestions.length === 0 && (
              <div className="px-4 py-3 text-center text-sm text-ink-muted">
                No se encontraron resultados para "{trimmedQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
