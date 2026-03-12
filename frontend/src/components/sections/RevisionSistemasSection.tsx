'use client';

import { FiCheck } from 'react-icons/fi';
import clsx from 'clsx';
import { RevisionSistemasData } from '@/types';

interface Props {
  data: RevisionSistemasData;
  onChange: (data: RevisionSistemasData) => void;
  readOnly?: boolean;
}

const SYSTEMS = [
  { key: 'psiquico', label: 'Psíquico', examples: 'Ánimo, sueño, ansiedad, memoria' },
  { key: 'cabeza', label: 'Cabeza', examples: 'Cefalea, mareos, visión, audición' },
  { key: 'cuello', label: 'Cuello', examples: 'Masas, dolor, rigidez' },
  { key: 'columna', label: 'Columna', examples: 'Dolor lumbar, cervical, dorsal' },
  { key: 'musculoArticulaciones', label: 'Músculo y articulaciones', examples: 'Dolor articular, debilidad, rigidez matinal' },
  { key: 'piel', label: 'Piel', examples: 'Lesiones, prurito, cambios de color' },
  { key: 'respiratorio', label: 'Respiratorio', examples: 'Tos, disnea, expectoración' },
  { key: 'cardiovascular', label: 'Cardiovascular', examples: 'Dolor torácico, palpitaciones, edema' },
  { key: 'gastrointestinal', label: 'Gastrointestinal', examples: 'Náuseas, vómitos, diarrea, estreñimiento' },
  { key: 'genitourinario', label: 'Génito-urinario', examples: 'Disuria, hematuria, frecuencia' },
  { key: 'neurologico', label: 'Neurológico', examples: 'Parestesias, debilidad focal, convulsiones' },
  { key: 'ginecologico', label: 'Ginecológico', examples: 'Metrorragia, dismenorrea, flujo' },
];

export default function RevisionSistemasSection({ data, onChange, readOnly }: Props) {
  const handleToggle = (systemKey: string) => {
    if (readOnly) return;
    
    const current = data[systemKey as keyof RevisionSistemasData] || { checked: false, notas: '' };
    onChange({
      ...data,
      [systemKey]: { ...current, checked: !current.checked },
    });
  };

  const handleNotasChange = (systemKey: string, notas: string) => {
    const current = data[systemKey as keyof RevisionSistemasData] || { checked: false, notas: '' };
    onChange({
      ...data,
      [systemKey]: { ...current, notas },
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 mb-4">
        Marque los sistemas con hallazgos positivos y agregue notas relevantes.
      </p>

      {SYSTEMS.map(({ key, label, examples }) => {
        const systemData = data[key as keyof RevisionSistemasData] || { checked: false, notas: '' };
        
        return (
          <div
            key={key}
            className={clsx(
              'p-4 rounded-lg border transition-colors',
              systemData.checked
                ? 'border-primary-300 bg-primary-50'
                : 'border-slate-200 bg-white'
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => handleToggle(key)}
                disabled={readOnly}
                className={clsx(
                  'w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                  systemData.checked
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'border-slate-300 hover:border-primary-400'
                )}
              >
                {systemData.checked && <FiCheck className="w-4 h-4" />}
              </button>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-900">{label}</span>
                  <span className="text-xs text-slate-500">{examples}</span>
                </div>
                
                {systemData.checked && (
                  <textarea
                    value={systemData.notas || ''}
                    onChange={(e) => handleNotasChange(key, e.target.value)}
                    disabled={readOnly}
                    rows={2}
                    className="form-input mt-2 resize-none"
                    placeholder="Describa los hallazgos..."
                  />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
