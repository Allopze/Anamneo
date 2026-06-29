'use client';

import { useEffect, useRef, useState } from 'react';
import { FiPackage, FiPlus, FiSearch } from 'react-icons/fi';
import { api } from '@/lib/api';
import { MedicationCatalogItem } from '@/types';
import { formatMedicationCatalogDefaults } from '@/lib/medication-catalog';

interface MedicationCatalogToolbarProps {
  readOnly?: boolean;
  onSelectSuggestion: (item: MedicationCatalogItem) => void;
  onAddManual: () => void;
}

export function MedicationCatalogToolbar({
  readOnly,
  onSelectSuggestion,
  onAddManual,
}: MedicationCatalogToolbarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MedicationCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();

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
    if (readOnly || !isOpen) {
      return;
    }

    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/medications?search=${encodeURIComponent(trimmedQuery)}`);
        if (!cancelled) {
          setSuggestions(response.data as MedicationCatalogItem[]);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, readOnly, trimmedQuery]);

  if (readOnly) {
    return null;
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex flex-col gap-2 rounded-card border border-surface-muted/35 bg-surface-base/45 p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            className="form-input pl-10"
            placeholder="Buscar medicamento del catálogo..."
            value={query}
            autoComplete="off"
            onFocus={() => setIsOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
          />
          {isLoading ? (
            <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-frame/35 border-t-frame-dark animate-spin" />
          ) : null}
        </div>

        <button
          type="button"
          onClick={onAddManual}
          className="btn btn-secondary shrink-0"
          data-testid="medication-add-manual"
        >
          <FiPlus className="h-4 w-4" />
          Agregar manual
        </button>
      </div>

      {isOpen && trimmedQuery.length >= 2 ? (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto dropdown-surface">
          {suggestions.length > 0 ? (
            <>
              <div className="dropdown-header py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Catálogo de medicamentos
                </p>
              </div>
              {suggestions.map((item) => {
                const defaultSummary = formatMedicationCatalogDefaults(item);

                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      onSelectSuggestion(item);
                      setQuery('');
                      setIsOpen(false);
                    }}
                    className="dropdown-item justify-between py-3"
                  >
                    <div className="min-w-0 text-left">
                      <p className="truncate font-medium text-ink-primary">{item.name}</p>
                      <p className="truncate text-xs text-ink-muted">
                        Principio activo: {item.activeIngredient}
                      </p>
                      {defaultSummary ? (
                        <p className="truncate text-xs text-ink-muted">Sugerido: {defaultSummary}</p>
                      ) : null}
                    </div>
                    <FiPackage className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                  </button>
                );
              })}
            </>
          ) : !isLoading ? (
            <div className="px-4 py-3 text-center text-sm text-ink-muted">
              Sin coincidencias en el catálogo.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface MedicationNameFieldProps {
  medication: {
    nombre?: string;
    activeIngredient?: string;
  };
  onManualChange: (value: string) => void;
  readOnly?: boolean;
}

export function MedicationNameField({
  medication,
  onManualChange,
  readOnly,
}: MedicationNameFieldProps) {
  return (
    <div>
      <input
        className="form-input"
        placeholder="Medicamento"
        data-testid="medication-manual-name"
        value={medication.nombre || ''}
        disabled={readOnly}
        autoComplete="off"
        onChange={(event) => {
          onManualChange(event.target.value);
        }}
      />

      {medication.activeIngredient ? (
        <p className="mt-1 text-xs text-ink-muted">
          Principio activo catalogado: {medication.activeIngredient}
        </p>
      ) : null}
    </div>
  );
}
