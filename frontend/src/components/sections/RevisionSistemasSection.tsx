'use client';

import { FiCheck, FiMinus } from 'react-icons/fi';
import clsx from 'clsx';
import { RevisionSistemasData, SystemReviewItem } from '@/types';
import { SectionBlock } from '@/components/sections/SectionPrimitives';

interface Props {
  data: RevisionSistemasData;
  onChange: (data: RevisionSistemasData) => void;
  readOnly?: boolean;
}

const SYSTEMS = [
  { key: 'psiquico', label: 'Psíquico', examples: 'Ánimo, sueño, ansiedad, memoria', suggestions: ['Ánimo depresivo', 'Insomnio', 'Ansiedad', 'Déficit de memoria', 'Irritabilidad'] },
  { key: 'cabeza', label: 'Cabeza', examples: 'Cefalea, mareos, visión, audición', suggestions: ['Cefalea', 'Mareos', 'Visión borrosa', 'Hipoacusia', 'Tinnitus'] },
  { key: 'cuello', label: 'Cuello', examples: 'Masas, dolor, rigidez', suggestions: ['Dolor cervical', 'Masa palpable', 'Rigidez', 'Adenopatías'] },
  { key: 'columna', label: 'Columna', examples: 'Dolor lumbar, cervical, dorsal', suggestions: ['Lumbalgia', 'Dorsalgia', 'Cervicalgia', 'Irradiación', 'Limitación funcional'] },
  { key: 'musculoArticulaciones', label: 'Músculo y articulaciones', examples: 'Dolor articular, debilidad, rigidez matinal', suggestions: ['Artralgia', 'Rigidez matinal', 'Debilidad muscular', 'Inflamación articular', 'Mialgias'] },
  { key: 'piel', label: 'Piel', examples: 'Lesiones, prurito, cambios de color', suggestions: ['Prurito', 'Erupciones', 'Lesiones ulceradas', 'Cambios de coloración', 'Sequedad'] },
  { key: 'respiratorio', label: 'Respiratorio', examples: 'Tos, disnea, expectoración', suggestions: ['Tos seca', 'Tos productiva', 'Disnea de esfuerzo', 'Disnea en reposo', 'Sibilancias', 'Expectoración'] },
  { key: 'cardiovascular', label: 'Cardiovascular', examples: 'Dolor torácico, palpitaciones, edema', suggestions: ['Dolor torácico', 'Palpitaciones', 'Edema EEII', 'Disnea paroxística', 'Síncope'] },
  { key: 'gastrointestinal', label: 'Gastrointestinal', examples: 'Náuseas, vómitos, diarrea, estreñimiento', suggestions: ['Náuseas', 'Vómitos', 'Diarrea', 'Estreñimiento', 'Dolor abdominal', 'Pirosis'] },
  { key: 'genitourinario', label: 'Génito-urinario', examples: 'Disuria, hematuria, frecuencia', suggestions: ['Disuria', 'Hematuria', 'Poliaquiuria', 'Urgencia miccional', 'Incontinencia'] },
  { key: 'neurologico', label: 'Neurológico', examples: 'Parestesias, debilidad focal, convulsiones', suggestions: ['Parestesias', 'Debilidad focal', 'Convulsiones', 'Temblor', 'Pérdida de sensibilidad'] },
  { key: 'ginecologico', label: 'Ginecológico', examples: 'Metrorragia, dismenorrea, flujo', suggestions: ['Metrorragia', 'Dismenorrea', 'Flujo vaginal', 'Dispareunia', 'Amenorrea'] },
];

export default function RevisionSistemasSection({ data, onChange, readOnly }: Props) {
  const allNegative = data.negativa === true;

  const getSystemData = (systemKey: string): SystemReviewItem => {
    const current = data[systemKey as keyof RevisionSistemasData];
    if (current && typeof current === 'object' && 'checked' in current) {
      return current as SystemReviewItem;
    }

    return { checked: false, notas: '' };
  };

  const handleToggle = (systemKey: string) => {
    if (readOnly) return;

    const current = getSystemData(systemKey);
    onChange({
      ...data,
      negativa: false,
      [systemKey]: { ...current, checked: !current.checked },
    });
  };

  const handleNotasChange = (systemKey: string, notas: string) => {
    const current = getSystemData(systemKey);
    onChange({
      ...data,
      negativa: false,
      [systemKey]: { ...current, notas },
    });
  };

  const handleAllNegativeToggle = () => {
    if (readOnly) return;

    onChange(allNegative ? {} : { negativa: true });
  };

  const handleSuggestionClick = (systemKey: string, suggestion: string) => {
    if (readOnly) return;
    const current = getSystemData(systemKey);
    const existingNotas = typeof current === 'object' && 'notas' in current ? (current.notas || '') : '';
    const alreadyPresent = existingNotas.toLowerCase().includes(suggestion.toLowerCase());
    if (alreadyPresent) return;
    const newNotas = existingNotas ? `${existingNotas}, ${suggestion}` : suggestion;
    onChange({
      ...data,
      negativa: false,
      [systemKey]: { checked: true, notas: newNotas },
    });
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Revisión por sistemas">
        {/* All-negative toggle */}
        {!readOnly && (
          <button
            type="button"
            onClick={handleAllNegativeToggle}
            className={clsx(
              'mb-4 flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left text-sm font-medium transition-colors',
              allNegative
                ? 'border-status-green/40 bg-status-green/10 text-status-green-text'
                : 'border-surface-muted/30 bg-surface-base/40 text-ink-secondary hover:border-surface-muted/50',
            )}
          >
            <span className={clsx(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition-colors',
              allNegative
                ? 'border-status-green bg-status-green text-white'
                : 'border-surface-muted/30',
            )}>
              {allNegative && <FiMinus className="h-4 w-4" />}
            </span>
            Revisión por sistemas negativa — nada que reportar
          </button>
        )}

        {allNegative && (
          <p className="text-sm text-ink-secondary">
            Se registrará que la revisión por sistemas es negativa en todos los aparatos. Si hay hallazgos en algún sistema, desactiva esta opción.
          </p>
        )}

        {!allNegative && (
          <div className="space-y-3">
            {SYSTEMS.map(({ key, label, examples, suggestions }) => {
              const systemData = getSystemData(key);

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
                          ? 'border-accent bg-accent/100 text-white'
                          : 'border-surface-muted/30 hover:border-accent/80'
                      )}
                    >
                      {systemData.checked && <FiCheck className="w-4 h-4" aria-hidden="true" />}
                    </button>

                    <div className="flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <span className="font-medium text-ink-primary">{label}</span>
                        <span className="text-xs text-ink-muted">{examples}</span>
                      </div>

                      {systemData.checked && (
                        <>
                          {/* Quick symptom suggestions */}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {suggestions.map((suggestion) => {
                              const isUsed = (systemData.notas || '').toLowerCase().includes(suggestion.toLowerCase());
                              return (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() => handleSuggestionClick(key, suggestion)}
                                  disabled={readOnly || isUsed}
                                  className={clsx(
                                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                    isUsed
                                      ? 'border-accent/30 bg-accent/10 text-accent-text'
                                      : 'border-surface-muted/30 bg-surface-base/40 text-ink-secondary hover:border-accent/50 hover:bg-accent/8',
                                  )}
                                >
                                  {suggestion}
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            value={systemData.notas || ''}
                            onChange={(e) => handleNotasChange(key, e.target.value)}
                            disabled={readOnly}
                            rows={2}
                            className="form-input form-textarea mt-3"
                            placeholder="Describa los hallazgos..."
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionBlock>
    </div>
  );
}
