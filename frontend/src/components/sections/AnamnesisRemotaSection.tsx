'use client';

import { FiAlertCircle, FiEdit2 } from 'react-icons/fi';
import { parseHistoryField } from '@/lib/utils';
import { AnamnesisRemotaData } from '@/types';

interface Props {
  data: AnamnesisRemotaData;
  onChange: (data: AnamnesisRemotaData) => void;
  readOnly?: boolean;
}

const HISTORY_FIELDS = [
  { key: 'antecedentesMedicos', label: 'Antecedentes médicos', placeholder: 'Enfermedades crónicas, hospitalizaciones previas...' },
  { key: 'antecedentesQuirurgicos', label: 'Antecedentes quirúrgicos', placeholder: 'Cirugías previas, fechas aproximadas...' },
  { key: 'antecedentesGinecoobstetricos', label: 'Antecedentes ginecoobstétricos', placeholder: 'Menarquia, embarazos, menopausia...' },
  { key: 'antecedentesFamiliares', label: 'Antecedentes familiares', placeholder: 'Enfermedades hereditarias, causas de muerte de familiares...' },
  { key: 'habitos', label: 'Hábitos', placeholder: 'Tabaco, alcohol, drogas, ejercicio, alimentación...' },
  { key: 'medicamentos', label: 'Uso de medicamentos', placeholder: 'Medicamentos actuales, dosis, frecuencia...' },
  { key: 'alergias', label: 'Alergias', placeholder: 'Medicamentos, alimentos, ambientales...' },
  { key: 'inmunizaciones', label: 'Inmunizaciones', placeholder: 'Vacunas recibidas, fechas...' },
  { key: 'antecedentesSociales', label: 'Antecedentes sociales', placeholder: 'Vivienda, trabajo, relaciones, situación económica...' },
  { key: 'antecedentesPersonales', label: 'Antecedentes personales', placeholder: 'Otros datos relevantes del paciente...' },
];

export default function AnamnesisRemotaSection({ data, onChange, readOnly }: Props) {
  const isReadOnlyFromHistory = data.readonly === true;
  const effectiveReadOnly = readOnly || isReadOnlyFromHistory;

  const handleChange = (field: string, value: string) => {
    onChange({
      ...data,
      [field]: { texto: value },
      readonly: false, // Mark as edited
    });
  };

  const handleEnableEdit = () => {
    onChange({ ...data, readonly: false });
  };

  return (
    <div className="space-y-6">
      {isReadOnlyFromHistory && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-amber-800">
              Esta información proviene del historial del paciente. Los cambios aquí
              actualizarán el historial permanente del paciente.
            </p>
            {!readOnly && (
              <button
                onClick={handleEnableEdit}
                className="mt-2 flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-800"
              >
                <FiEdit2 className="w-4 h-4" />
                Editar historial
              </button>
            )}
          </div>
        </div>
      )}

      {HISTORY_FIELDS.map(({ key, label, placeholder }) => {
        const fieldKey = key as keyof AnamnesisRemotaData;
        const rawVal = data[fieldKey];
        const val = parseHistoryField(rawVal);
        const hasItems = val?.items?.length > 0;
        
        return (
          <div key={key} className="space-y-2">
            <label className="form-label">{label}</label>
            
            {hasItems && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {val.items.map((item: string) => (
                  <span key={item} className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs border border-slate-200">
                    {item}
                  </span>
                ))}
              </div>
            )}

            <textarea
              value={typeof val === 'object' ? val?.texto || '' : val || ''}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={effectiveReadOnly}
              rows={2}
              className="form-input resize-none"
              placeholder={placeholder}
            />
          </div>
        );
      })}
    </div>
  );
}
