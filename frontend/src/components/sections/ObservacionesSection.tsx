'use client';

import { ObservacionesData } from '@/types';

interface Props {
  data: ObservacionesData;
  onChange: (data: ObservacionesData) => void;
  readOnly?: boolean;
}

export default function ObservacionesSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="form-label">Observaciones generales</label>
        <textarea
          value={data.observaciones || ''}
          onChange={(e) => handleChange('observaciones', e.target.value)}
          disabled={readOnly}
          rows={6}
          className="form-input resize-none"
          placeholder="Cualquier observación adicional relevante para el registro..."
        />
      </div>

      <div>
        <label className="form-label">Notas internas (no visibles en ficha impresa)</label>
        <textarea
          value={data.notasInternas || ''}
          onChange={(e) => handleChange('notasInternas', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input resize-none bg-amber-50"
          placeholder="Notas de uso interno, recordatorios para el equipo médico..."
        />
        <p className="text-xs text-amber-600 mt-1">
          ⚠️ Estas notas no se incluirán en la ficha clínica exportada a PDF.
        </p>
      </div>
    </div>
  );
}
