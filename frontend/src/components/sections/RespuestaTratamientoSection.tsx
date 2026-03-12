'use client';

import { RespuestaTratamientoData } from '@/types';

interface Props {
  data: RespuestaTratamientoData;
  onChange: (data: RespuestaTratamientoData) => void;
  readOnly?: boolean;
}

export default function RespuestaTratamientoSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="form-label">Evolución con el tratamiento</label>
        <textarea
          value={data.evolucion || ''}
          onChange={(e) => handleChange('evolucion', e.target.value)}
          disabled={readOnly}
          rows={4}
          className="form-input resize-none"
          placeholder="Describa cómo ha respondido el paciente al tratamiento indicado..."
        />
      </div>

      <div>
        <label className="form-label">Resultados de exámenes</label>
        <textarea
          value={data.resultadosExamenes || ''}
          onChange={(e) => handleChange('resultadosExamenes', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input resize-none"
          placeholder="Resultados relevantes de exámenes solicitados..."
        />
      </div>

      <div>
        <label className="form-label">Ajustes al tratamiento</label>
        <textarea
          value={data.ajustesTratamiento || ''}
          onChange={(e) => handleChange('ajustesTratamiento', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input resize-none"
          placeholder="Cambios realizados al plan de tratamiento inicial..."
        />
      </div>

      <div>
        <label className="form-label">Plan de seguimiento</label>
        <textarea
          value={data.planSeguimiento || ''}
          onChange={(e) => handleChange('planSeguimiento', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input resize-none"
          placeholder="Próximos controles, indicaciones de seguimiento..."
        />
      </div>
    </div>
  );
}
