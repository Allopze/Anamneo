'use client';

import { useState } from 'react';
import { FiAlertTriangle, FiRefreshCcw } from 'react-icons/fi';
import {
  SEXO_LABELS,
  PREVISION_LABELS,
  IdentificacionData,
  EncounterIdentificationSnapshotStatus,
} from '@/types';
import { validateRut } from '@/lib/rut';
import { SectionBlock, SectionIntro } from '@/components/sections/SectionPrimitives';

interface Props {
  data: IdentificacionData;
  onChange: (data: IdentificacionData) => void;
  readOnly?: boolean;
  snapshotStatus?: EncounterIdentificationSnapshotStatus;
  onRestoreFromPatient?: () => void;
}

export default function IdentificacionSection({
  data,
  onChange,
  readOnly,
  snapshotStatus,
  onRestoreFromPatient,
}: Props) {
  const [rutError, setRutError] = useState<string | null>(null);

  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const handleRutChange = (value: string) => {
    handleChange('rut', value);
    if (!value || data.rutExempt) {
      setRutError(null);
      return;
    }
    // Only validate when it looks complete (has hyphen or 7+ chars)
    if (value.length >= 7 || value.includes('-')) {
      const result = validateRut(value);
      setRutError(result.valid ? null : 'RUT inválido');
    } else {
      setRutError(null);
    }
  };

  return (
    <div className="space-y-5">
      <SectionIntro description="Confirma los datos administrativos y demográficos antes de continuar con la atención." />

      <div className="rounded-2xl border border-surface-muted/30 bg-surface-base/40 p-4">
        <p className="text-sm font-medium text-ink-primary">Snapshot administrativo de la atención</p>
        <p className="mt-2 text-sm text-ink-secondary">
          Esta sección representa la identificación usada dentro de esta atención. No se edita aquí: si necesitas corregir el dato maestro, hazlo en la ficha del paciente y luego restaura este snapshot.
        </p>
        {snapshotStatus?.hasDifferences && (
          <div className="mt-3 rounded-2xl border border-status-yellow/30 bg-status-yellow/10 p-3 text-sm text-status-yellow">
            <div className="flex items-start gap-2">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Se detectó divergencia con la ficha maestra</p>
                <p className="mt-1">
                  Campos con diferencia: {snapshotStatus.differingFieldLabels.join(', ')}.
                </p>
              </div>
            </div>
            {onRestoreFromPatient && (
              <button
                type="button"
                onClick={onRestoreFromPatient}
                className="btn btn-secondary mt-3 inline-flex items-center gap-2"
              >
                <FiRefreshCcw className="h-4 w-4" />
                Restaurar desde ficha maestra
              </button>
            )}
          </div>
        )}
      </div>

      <SectionBlock title="Datos personales" description="Identificación base del paciente en esta atención.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Nombre completo</label>
              <input
                type="text"
                value={data.nombre || ''}
                onChange={(e) => handleChange('nombre', e.target.value)}
                disabled={readOnly}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">RUT</label>
              <input
                type="text"
                value={data.rut || ''}
                onChange={(e) => handleRutChange(e.target.value)}
                disabled={readOnly}
                className={`form-input ${rutError ? 'border-red-400' : ''}`}
                placeholder={data.rutExempt ? 'Sin RUT' : '12.345.678-5'}
                aria-invalid={!!rutError}
                aria-describedby={rutError ? 'rut-error' : undefined}
              />
              {rutError && <p id="rut-error" className="text-xs text-status-red mt-1" role="alert">{rutError}</p>}
              {data.rutExempt && data.rutExemptReason && (
                <p className="text-sm text-ink-muted mt-1">Motivo: {data.rutExemptReason}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="form-label">Edad</label>
              <input
                type="number"
                value={data.edad || ''}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  handleChange('edad', nextValue === '' ? undefined : parseInt(nextValue, 10));
                }}
                disabled={readOnly}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Sexo</label>
              <select
                value={data.sexo || ''}
                onChange={(e) => handleChange('sexo', e.target.value)}
                disabled={readOnly}
                className="form-input"
              >
                <option value="" disabled>Seleccionar...</option>
                {Object.entries(SEXO_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Previsión</label>
              <select
                value={data.prevision || ''}
                onChange={(e) => handleChange('prevision', e.target.value)}
                disabled={readOnly}
                className="form-input"
              >
                <option value="" disabled>Seleccionar...</option>
                {Object.entries(PREVISION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Contexto y contacto" description="Datos útiles para continuidad asistencial y contexto social básico.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="form-label">Trabajo / Ocupación</label>
            <input
              type="text"
              value={data.trabajo || ''}
              onChange={(e) => handleChange('trabajo', e.target.value)}
              disabled={readOnly}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Domicilio</label>
            <input
              type="text"
              value={data.domicilio || ''}
              onChange={(e) => handleChange('domicilio', e.target.value)}
              disabled={readOnly}
              className="form-input"
            />
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
