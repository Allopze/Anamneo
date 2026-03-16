'use client';

import { FiCheck } from 'react-icons/fi';
import clsx from 'clsx';
import { RevisionSistemasData } from '@/types';
import { SectionBlock, SectionIntro } from '@/components/sections/SectionPrimitives';

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
    <div className="space-y-5">
      <SectionIntro description="Marca los sistemas con hallazgos positivos y deja una nota breve solo cuando aporte contexto clínico." />

      <SectionBlock title="Revisión por sistemas" description="Cada sistema se activa solo si hay hallazgos o síntomas relevantes.">
        <div className="space-y-3">
          {SYSTEMS.map(({ key, label, examples }) => {
            const systemData = data[key as keyof RevisionSistemasData] || { checked: false, notas: '' };

            return (
              <div
                key={key}
                className={clsx(
                  'section-item-card',
                  systemData.checked && 'section-item-card-selected'
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(key)}
                    disabled={readOnly}
                    role="checkbox"
                    aria-checked={systemData.checked}
                    aria-label={label}
                    className={clsx(
                      'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
                      systemData.checked
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-slate-300 hover:border-primary-400'
                    )}
                  >
                    {systemData.checked && <FiCheck className="w-4 h-4" aria-hidden="true" />}
                  </button>

                  <div className="flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <span className="font-medium text-slate-900">{label}</span>
                      <span className="text-xs text-slate-500">{examples}</span>
                    </div>

                    {systemData.checked && (
                      <textarea
                        value={systemData.notas || ''}
                        onChange={(e) => handleNotasChange(key, e.target.value)}
                        disabled={readOnly}
                        rows={2}
                        className="form-input mt-3 resize-none"
                        placeholder="Describa los hallazgos..."
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </SectionBlock>
    </div>
  );
}
