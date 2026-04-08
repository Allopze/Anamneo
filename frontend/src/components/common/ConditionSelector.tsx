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
    <div className="space-y-2" ref={wrapperRef}>
      {label && <label className="form-label">{label}</label>}
      
      {/* Selected tags */}
      <div className="flex flex-wrap gap-2 mb-2">
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-full border border-status-yellow/65 bg-status-yellow/35 px-2.5 py-1 text-sm font-medium text-accent-text animate-fade-in"
          >
            <FiTag className="w-3 h-3" />
            {item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="rounded-full p-0.5 transition-colors hover:bg-status-yellow/40"
            >
              <FiX className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Input and suggestions */}
      <div className="relative">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Buscar afección...'}
            className="form-input pl-10"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (trimmedQuery || suggestions.length > 0) && (
          <div className="absolute z-50 w-full mt-2 dropdown-surface max-h-64 overflow-y-auto">
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
                    <div className="flex gap-1 mt-0.5">
                      {parseJsonArray(condition.tags).map((tag: string) => (
                        <span key={tag} className="text-[10px] bg-surface-muted px-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <FiPlus className="w-4 h-4 text-ink-muted" />
              </button>
            ))}

            {/* Manual add option */}
            {trimmedQuery && !hasExactSuggestion && (
              <div className="border-t border-surface-muted/20 bg-status-yellow/15">
                <button
                  type="button"
                  onClick={() => {
                    void handleAdd(trimmedQuery);
                  }}
                  className="dropdown-item py-3 text-accent-text"
                >
                  <FiPlus className="w-4 h-4" />
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
                      'dropdown-item py-3 text-ink-primary',
                      isPersistingToCatalog && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <FiPlus className="w-4 h-4" />
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
              <div className="px-4 py-3 text-sm text-ink-muted text-center">
                No se encontraron resultados para "{trimmedQuery}"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
