'use client';

import { useMemo } from 'react';
import { FiAlertTriangle, FiTrash2 } from 'react-icons/fi';
import { MedicationCatalogItem, StructuredMedication, type HistoryFieldValue } from '@/types';
import { MEDICATION_ROUTE_OPTIONS } from '@/lib/medication-catalog';
import { parseHistoryField } from '@/lib/utils';
import TreatmentDiagnosisSelect, { type TreatmentDiagnosisOption } from '@/components/sections/TreatmentDiagnosisSelect';
import {
  SectionIconButton,
} from '@/components/sections/SectionPrimitives';
import { MedicationCatalogToolbar, MedicationNameField } from './StructuredMedicationsEditor.parts';

interface StructuredMedicationsEditorProps {
  medications: StructuredMedication[];
  onChange: (next: StructuredMedication[]) => void;
  readOnly?: boolean;
  allergyData?: HistoryFieldValue | string;
  diagnosticOptions?: TreatmentDiagnosisOption[];
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

  const createMedication = (patch: Partial<StructuredMedication> = {}) => ({
    id: createId(),
    nombre: '',
    dosis: '',
    via: '',
    frecuencia: '',
    duracion: '',
    indicacion: '',
    ...patch,
  });

  const appendMedication = (patch: Partial<StructuredMedication> = {}) => {
    const blankIndex = medications.findIndex((item) =>
      isBlank(item.nombre)
      && isBlank(item.dosis)
      && isBlank(item.via)
      && isBlank(item.frecuencia)
      && isBlank(item.duracion)
      && isBlank(item.indicacion)
      && !item.activeIngredient,
    );

    if (blankIndex >= 0) {
      updateMedication(blankIndex, patch);
      return;
    }

    onChange([...medications, createMedication(patch)]);
  };

  const addCatalogMedication = (item: MedicationCatalogItem) => {
    const nameBlankIndex = medications.findIndex((entry) => isBlank(entry.nombre));

    if (nameBlankIndex >= 0) {
      const current = medications[nameBlankIndex];
      updateMedication(nameBlankIndex, {
        nombre: item.name,
        activeIngredient: item.activeIngredient,
        ...((!current.dosis || isBlank(current.dosis)) && item.defaultDose
          ? { dosis: item.defaultDose }
          : {}),
        ...((!current.via || isBlank(current.via)) && item.defaultRoute
          ? { via: item.defaultRoute }
          : {}),
        ...((!current.frecuencia || isBlank(current.frecuencia)) && item.defaultFrequency
          ? { frecuencia: item.defaultFrequency }
          : {}),
      });
      return;
    }

    appendMedication({
      nombre: item.name,
      activeIngredient: item.activeIngredient,
      ...(item.defaultDose ? { dosis: item.defaultDose } : {}),
      ...(item.defaultRoute ? { via: item.defaultRoute } : {}),
      ...(item.defaultFrequency ? { frecuencia: item.defaultFrequency } : {}),
    });
  };

  return (
    <div className="space-y-2">
      <MedicationCatalogToolbar
        readOnly={readOnly}
        onAddManual={() => appendMedication()}
        onSelectSuggestion={addCatalogMedication}
      />

      {medications.map((medication, index) => {
        const allergyMatch = getAllergyMatch(medication.nombre || '');

        return (
          <div key={medication.id} className="section-item-card grid grid-cols-1 gap-2 md:grid-cols-7">
            <div className={`md:col-span-2${allergyMatch ? ' rounded-input border border-status-red/60 p-2' : ''}`}>
              <MedicationNameField
                medication={medication}
                readOnly={readOnly}
                onManualChange={(value) => {
                  updateMedication(index, { nombre: value, activeIngredient: undefined });
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

    </div>
  );
}
