'use client';

import { AnamnesisProximaData } from '@/types';

interface Props {
  data: AnamnesisProximaData;
  onChange: (data: AnamnesisProximaData) => void;
  readOnly?: boolean;
}

export default function AnamnesisProximaSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="form-label">Relato ampliado</label>
        <textarea
          value={data.relatoAmpliado || ''}
          onChange={(e) => handleChange('relatoAmpliado', e.target.value)}
          disabled={readOnly}
          rows={4}
          className="form-input resize-none"
          placeholder="Describa en detalle la evolución y características del cuadro actual..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Inicio</label>
          <input
            type="text"
            value={data.inicio || ''}
            onChange={(e) => handleChange('inicio', e.target.value)}
            disabled={readOnly}
            className="form-input"
            placeholder="Ej: Hace 3 días, súbito"
          />
        </div>
        <div>
          <label className="form-label">Evolución</label>
          <input
            type="text"
            value={data.evolucion || ''}
            onChange={(e) => handleChange('evolucion', e.target.value)}
            disabled={readOnly}
            className="form-input"
            placeholder="Ej: Progresivo, intermitente"
          />
        </div>
      </div>

      <div>
        <label className="form-label">Factores agravantes</label>
        <textarea
          value={data.factoresAgravantes || ''}
          onChange={(e) => handleChange('factoresAgravantes', e.target.value)}
          disabled={readOnly}
          rows={2}
          className="form-input resize-none"
          placeholder="¿Qué empeora los síntomas?"
        />
      </div>

      <div>
        <label className="form-label">Factores atenuantes</label>
        <textarea
          value={data.factoresAtenuantes || ''}
          onChange={(e) => handleChange('factoresAtenuantes', e.target.value)}
          disabled={readOnly}
          rows={2}
          className="form-input resize-none"
          placeholder="¿Qué mejora los síntomas?"
        />
      </div>

      <div>
        <label className="form-label">Síntomas asociados</label>
        <textarea
          value={data.sintomasAsociados || ''}
          onChange={(e) => handleChange('sintomasAsociados', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input resize-none"
          placeholder="Otros síntomas que acompañan al cuadro principal..."
        />
      </div>
    </div>
  );
}
