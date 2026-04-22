'use client';

import { useEffect, useRef, useState } from 'react';
import { FiPackage, FiPlus, FiSearch, FiX } from 'react-icons/fi';

import { api } from '@/lib/api';
import type { MedicationCatalogItem } from '@/types';

export interface PatientMedicationHistoryValue {
  items: string[];
  texto: string;
}

interface Props {
  value: PatientMedicationHistoryValue;
  onChange: (next: PatientMedicationHistoryValue) => void;
  readOnly?: boolean;
}

function normalizeMedicationName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export default function PatientMedicationHistoryField({ value, onChange, readOnly }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MedicationCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
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
    if (readOnly || !isOpen) {
      return;
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
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
      window.clearTimeout(timer);
    };
  }, [isOpen, query, readOnly]);

  if (readOnly) {
    return (
      <div className="space-y-3" ref={wrapperRef}>
        {value.items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {value.items.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 rounded-full border border-surface-muted/45 bg-surface-inset px-2.5 py-1 text-sm font-medium text-ink"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
        <p className="whitespace-pre-wrap text-sm text-ink-secondary">{value.texto || 'Sin registro'}</p>
      </div>
    );
  }

  const addMedication = (name: string) => {
    const normalizedName = normalizeMedicationName(name);
    if (!normalizedName) {
      return;
    }

    if (!value.items.some((item) => item.toLowerCase() === normalizedName.toLowerCase())) {
      onChange({ ...value, items: [...value.items, normalizedName] });
    }

    setQuery('');
    setIsOpen(false);
  };

  const removeMedication = (name: string) => {
    onChange({
      ...value,
      items: value.items.filter((item) => item !== name),
    });
  };

  const trimmedQuery = query.trim();

  return (
    <div className="space-y-4" ref={wrapperRef}>
      <div className="rounded-card border border-surface-muted/35 bg-surface-base/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="form-label mb-0">Medicación habitual</label>
          <span className="text-xs font-medium text-ink-muted">
            {value.items.length} {value.items.length === 1 ? 'medicamento' : 'medicamentos'}
          </span>
        </div>

        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addMedication(trimmedQuery);
              }
            }}
            placeholder="Buscar o escribir un medicamento habitual"
            className="form-input pl-10"
          />
          {isLoading ? (
            <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-frame/35 border-t-frame-dark animate-spin" />
          ) : null}
        </div>

        <p className="mt-2 text-xs text-ink-muted">
          Usa la lista para nombres de medicamentos y el detalle para dosis, frecuencia o aclaraciones.
        </p>
      </div>

      {value.items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-surface-muted/45 bg-surface-inset px-2.5 py-1 text-sm font-medium text-ink animate-fade-in"
            >
              <FiPackage className="h-3 w-3 text-ink-muted" />
              {item}
              <button
                type="button"
                onClick={() => removeMedication(item)}
                className="rounded-full p-0.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
              >
                <FiX className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="form-label">Detalle clínico</label>
        <textarea
          value={value.texto}
          onChange={(event) => onChange({ ...value, texto: event.target.value })}
          placeholder="Dosis, frecuencia, motivo de uso, observaciones..."
          rows={3}
          className="form-input form-textarea"
        />
      </div>

      {isOpen && trimmedQuery.length >= 2 ? (
        <div className="relative">
          <div className="absolute z-50 mt-0 w-full dropdown-surface max-h-64 overflow-y-auto">
            {suggestions.length > 0 ? (
              <>
                <div className="dropdown-header py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Catálogo de medicamentos
                  </p>
                </div>
                {suggestions.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => addMedication(item.name)}
                    className="dropdown-item justify-between py-3"
                  >
                    <div className="min-w-0 text-left">
                      <p className="truncate font-medium text-ink-primary">{item.name}</p>
                      <p className="truncate text-xs text-ink-muted">Principio activo: {item.activeIngredient}</p>
                    </div>
                    <FiPlus className="h-4 w-4 flex-shrink-0 text-ink-muted" />
                  </button>
                ))}
              </>
            ) : !isLoading ? (
              <button type="button" onClick={() => addMedication(trimmedQuery)} className="dropdown-item py-3 text-ink">
                <FiPlus className="h-4 w-4" />
                <span>Agregar medicamento habitual: <strong>"{trimmedQuery}"</strong></span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}