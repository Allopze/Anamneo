'use client';

import { TratamientoData } from '@/types';

interface Props {
  data: TratamientoData;
  onChange: (data: TratamientoData) => void;
  readOnly?: boolean;
}

export default function TratamientoSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="form-label">Plan de tratamiento</label>
        <textarea
          value={data.plan || ''}
          onChange={(e) => handleChange('plan', e.target.value)}
          disabled={readOnly}
          rows={4}
          className="form-input resize-none"
          placeholder="Describa el plan terapéutico general..."
        />
      </div>

      <div>
        <label className="form-label">Indicaciones</label>
        <textarea
          value={data.indicaciones || ''}
          onChange={(e) => handleChange('indicaciones', e.target.value)}
          disabled={readOnly}
          rows={4}
          className="form-input resize-none"
          placeholder="Indicaciones para el paciente (reposo, dieta, cuidados, controles)..."
        />
      </div>

      <div>
        <label className="form-label">Receta / Medicamentos</label>
        <textarea
          value={data.receta || ''}
          onChange={(e) => handleChange('receta', e.target.value)}
          disabled={readOnly}
          rows={4}
          className="form-input resize-none"
          placeholder="Medicamento - Dosis - Frecuencia - Duración..."
        />
        <p className="text-xs text-slate-500 mt-1">
          Nota: Este campo es solo para registro. No genera recetas automáticas.
        </p>
      </div>

      <div>
        <label className="form-label">Exámenes solicitados</label>
        <textarea
          value={data.examenes || ''}
          onChange={(e) => handleChange('examenes', e.target.value)}
          disabled={readOnly}
          rows={2}
          className="form-input resize-none"
          placeholder="Hemograma, perfil bioquímico, radiografía..."
        />
      </div>

      <div>
        <label className="form-label">Derivaciones</label>
        <textarea
          value={data.derivaciones || ''}
          onChange={(e) => handleChange('derivaciones', e.target.value)}
          disabled={readOnly}
          rows={2}
          className="form-input resize-none"
          placeholder="Especialista, motivo de derivación..."
        />
      </div>
    </div>
  );
}
