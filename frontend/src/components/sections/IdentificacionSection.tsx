'use client';

import { useState } from 'react';
import { SEXO_LABELS, PREVISION_LABELS, IdentificacionData } from '@/types';
import { validateRut } from '@/lib/rut';

interface Props {
  data: IdentificacionData;
  onChange: (data: IdentificacionData) => void;
  readOnly?: boolean;
}

export default function IdentificacionSection({ data, onChange, readOnly }: Props) {
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          {rutError && <p id="rut-error" className="text-xs text-red-500 mt-1" role="alert">{rutError}</p>}
          {data.rutExempt && data.rutExemptReason && (
            <p className="text-sm text-slate-500 mt-1">Motivo: {data.rutExemptReason}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="form-label">Edad</label>
          <input
            type="number"
            value={data.edad || ''}
            onChange={(e) => handleChange('edad', parseInt(e.target.value))}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </div>
  );
}
