'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertTriangle, FiPackage, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import { api } from '@/lib/api';
import { MedicationCatalogItem, StructuredMedication, type HistoryFieldValue } from '@/types';
import { formatMedicationCatalogDefaults, MEDICATION_ROUTE_OPTIONS } from '@/lib/medication-catalog';
import { parseHistoryField } from '@/lib/utils';
import TreatmentDiagnosisSelect, { type TreatmentDiagnosisOption } from '@/components/sections/TreatmentDiagnosisSelect';
import {
  SectionAddButton,
  SectionIconButton,
} from '@/components/sections/SectionPrimitives';

interface StructuredMedicationsEditorProps {
  medications: StructuredMedication[];
  onChange: (next: StructuredMedication[]) => void;
  readOnly?: boolean;
  allergyData?: HistoryFieldValue | string;
  diagnosticOptions?: TreatmentDiagnosisOption[];
}

interface MedicationCatalogFieldProps {
  medication: StructuredMedication;
  onManualChange: (value: string) => void;
  onSelectSuggestion: (item: MedicationCatalogItem) => void;
  readOnly?: boolean;
}

function MedicationCatalogField({
  medication,
  onManualChange,
  onSelectSuggestion,
  readOnly,
}: MedicationCatalogFieldProps) {
  const [suggestions, setSuggestions] = useState<MedicationCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = medication.nombre?.trim() || '';

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

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          className="form-input pl-10"
          placeholder="Medicamento"
          value={medication.nombre || ''}
          disabled={readOnly}
          autoComplete="off"
          onFocus={() => {
            if (!readOnly) {
              setIsOpen(true);
            }
          }}
          onChange={(event) => {
            onManualChange(event.target.value);
            if (!readOnly) {
              setIsOpen(true);
            }
          }}
        />
        {isLoading ? (
          <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        ) : null}
      </div>

      {medication.activeIngredient ? (
        <p className="mt-1 text-xs text-ink-muted">
          Principio activo catalogado: {medication.activeIngredient}
        </p>
      ) : null}

      {isOpen && !readOnly && trimmedQuery.length >= 2 ? (
        <div className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto dropdown-surface">
          {suggestions.length > 0 ? (
            <>
              <div className="dropdown-header py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Catálogo de medicamentos
                </p>
              </div>
              {suggestions.map((item) => (
                (() => {
                  const defaultSummary = formatMedicationCatalogDefaults(item);

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        onSelectSuggestion(item);
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
                })()
              ))}
            </>
          ) : !isLoading ? (
            <div className="px-4 py-3 text-sm text-center text-ink-muted">
              Sin coincidencias en el catálogo. Puedes seguir con texto libre.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function StructuredMedicationsEditor({
  medications,
  onChange,
  readOnly,
  allergyData,
  diagnosticOptions = [],
}: StructuredMedicationsEditorProps) {
  const isBlank = (value: string | undefined) => !value || value.trim().length === 0;

  const allergyKeywords = useMemo(() => {
    if (!allergyData) {
      return [];
    }

    const parsed = parseHistoryField(allergyData);
    const keywords: string[] = [];

    if (Array.isArray(parsed?.items)) {
      for (const item of parsed.items) {
        if (typeof item === 'string' && item.trim()) {
          keywords.push(item.trim().toLowerCase());
        }
      }
    }

    if (typeof parsed?.texto === 'string' && parsed.texto.trim()) {
      for (const word of parsed.texto.split(/[,;.\n]+/)) {
        const trimmed = word.trim().toLowerCase();
        if (trimmed.length >= 3) {
          keywords.push(trimmed);
        }
      }
    }

    return keywords;
  }, [allergyData]);

  const createId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const getAllergyMatch = (medicationName: string) => {
    if (!medicationName || allergyKeywords.length === 0) {
      return null;
    }

    const lower = medicationName.toLowerCase();
    for (const keyword of allergyKeywords) {
      if (lower.includes(keyword) || keyword.includes(lower)) {
        return keyword;
      }
    }

    return null;
  };

  const updateMedication = (index: number, patch: Partial<StructuredMedication>) => {
    const next = [...medications];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {medications.map((medication, index) => {
        const allergyMatch = getAllergyMatch(medication.nombre || '');

        return (
          <div key={medication.id} className="section-item-card grid grid-cols-1 gap-2 md:grid-cols-7">
            <div className={`md:col-span-2${allergyMatch ? ' rounded-input border border-status-red/60 p-2' : ''}`}>
              <MedicationCatalogField
                medication={medication}
                readOnly={readOnly}
                onManualChange={(value) => {
                  updateMedication(index, { nombre: value, activeIngredient: undefined });
                }}
                onSelectSuggestion={(item) => {
                  const nextMedication: Partial<StructuredMedication> = {
                    nombre: item.name,
                    activeIngredient: item.activeIngredient,
                    ...(!medication.dosis || isBlank(medication.dosis)
                      ? item.defaultDose
                        ? { dosis: item.defaultDose }
                        : {}
                      : {}),
                    ...(!medication.via || isBlank(medication.via)
                      ? item.defaultRoute
                        ? { via: item.defaultRoute }
                        : {}
                      : {}),
                    ...(!medication.frecuencia || isBlank(medication.frecuencia)
                      ? item.defaultFrequency
                        ? { frecuencia: item.defaultFrequency }
                        : {}
                      : {}),
                  };

                  updateMedication(index, {
                    ...nextMedication,
                  });
                }}
              />
            </div>

            {allergyMatch ? (
              <div className="flex items-center gap-1.5 md:col-span-full" role="alert">
                <FiAlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-red" />
                <span className="text-xs font-medium text-status-red-text">
                  Posible alergia registrada: {allergyMatch}
                </span>
              </div>
            ) : null}

            <input
              className="form-input"
              placeholder="Dosis"
              value={medication.dosis || ''}
              disabled={readOnly}
              onChange={(event) => updateMedication(index, { dosis: event.target.value })}
            />
            <select
              className="form-input"
              value={medication.via || ''}
              disabled={readOnly}
              onChange={(event) => updateMedication(index, { via: event.target.value })}
            >
              <option value="">Vía…</option>
              {MEDICATION_ROUTE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              placeholder="Frecuencia"
              value={medication.frecuencia || ''}
              disabled={readOnly}
              onChange={(event) => updateMedication(index, { frecuencia: event.target.value })}
            />
            {diagnosticOptions.length > 0 ? (
              <TreatmentDiagnosisSelect
                options={diagnosticOptions}
                value={medication.sospechaId}
                disabled={readOnly}
                ariaLabel="Diagnóstico asociado del medicamento"
                onChange={(value) => updateMedication(index, { sospechaId: value || undefined })}
              />
            ) : null}
            {!readOnly ? (
              <SectionIconButton
                onClick={() => onChange(medications.filter((item) => item.id !== medication.id))}
                tone="danger"
                ariaLabel="Eliminar medicamento"
              >
                <FiTrash2 className="h-4 w-4" />
              </SectionIconButton>
            ) : null}
            <input
              className="form-input md:col-span-full"
              placeholder="Duración (ej: 7 días, uso continuo…)"
              value={medication.duracion || ''}
              disabled={readOnly}
              onChange={(event) => updateMedication(index, { duracion: event.target.value })}
            />
          </div>
        );
      })}

      {!readOnly ? (
        <SectionAddButton
          onClick={() =>
            onChange([
              ...medications,
              {
                id: createId(),
                nombre: '',
                dosis: '',
                via: '',
                frecuencia: '',
                duracion: '',
                indicacion: '',
              },
            ])
          }
        >
          <FiPlus className="h-4 w-4" />
          Agregar medicamento
        </SectionAddButton>
      ) : null}
    </div>
  );
}