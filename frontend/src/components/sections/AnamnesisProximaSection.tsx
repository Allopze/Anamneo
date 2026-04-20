'use client';

import clsx from 'clsx';
import { AnamnesisProximaData, PerfilDolorAbdominalData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionFieldHeader } from '@/components/sections/SectionPrimitives';

const ABDOMINAL_SYMPTOMS: Array<{ key: keyof PerfilDolorAbdominalData; label: string }> = [
  { key: 'presente', label: 'Dolor abdominal presente' },
  { key: 'vomitos', label: 'Vómitos' },
  { key: 'diarrea', label: 'Diarrea' },
  { key: 'nauseas', label: 'Náuseas' },
  { key: 'estrenimiento', label: 'Estreñimiento' },
];

interface Props {
  data: AnamnesisProximaData;
  onChange: (data: AnamnesisProximaData) => void;
  readOnly?: boolean;
}

export default function AnamnesisProximaSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const perfilDolorAbdominal = data.perfilDolorAbdominal || {};

  const handleDolorAbdominalToggle = (field: keyof PerfilDolorAbdominalData) => {
    const currentValue = perfilDolorAbdominal[field];
    handleChange('perfilDolorAbdominal', {
      ...perfilDolorAbdominal,
      [field]: currentValue === true ? false : true,
    });
  };

  const handleDolorAbdominalField = (field: keyof PerfilDolorAbdominalData, value: string) => {
    handleChange('perfilDolorAbdominal', {
      ...perfilDolorAbdominal,
      [field]: value,
    });
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Relato del cuadro actual">
        <SectionFieldHeader
          label="Relato ampliado"
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) =>
                handleChange('relatoAmpliado', `${data.relatoAmpliado ? `${data.relatoAmpliado} ` : ''}${text}`.trim())
              }
            />
          ) : undefined}
        />
        <textarea
          value={data.relatoAmpliado || ''}
          onChange={(e) => handleChange('relatoAmpliado', e.target.value)}
          disabled={readOnly}
          rows={4}
          className="form-input form-textarea"
          placeholder=""
        />
      </SectionBlock>

      <SectionBlock title="Cronología y moduladores">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <SectionFieldHeader
              label="Factores agravantes"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('factoresAgravantes', `${data.factoresAgravantes ? `${data.factoresAgravantes} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.factoresAgravantes || ''}
              onChange={(e) => handleChange('factoresAgravantes', e.target.value)}
              disabled={readOnly}
              rows={2}
              className="form-input form-textarea"
              placeholder="¿Qué empeora los síntomas?"
            />
          </div>

          <div>
            <SectionFieldHeader
              label="Factores atenuantes"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('factoresAtenuantes', `${data.factoresAtenuantes ? `${data.factoresAtenuantes} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.factoresAtenuantes || ''}
              onChange={(e) => handleChange('factoresAtenuantes', e.target.value)}
              disabled={readOnly}
              rows={2}
              className="form-input form-textarea"
              placeholder="¿Qué mejora los síntomas?"
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Síntomas asociados">
        <SectionFieldHeader
          label="Síntomas asociados"
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) =>
                handleChange('sintomasAsociados', `${data.sintomasAsociados ? `${data.sintomasAsociados} ` : ''}${text}`.trim())
              }
            />
          ) : undefined}
        />
        <textarea
          value={data.sintomasAsociados || ''}
          onChange={(e) => handleChange('sintomasAsociados', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input form-textarea"
          placeholder=""
        />

        <div className="mt-4 rounded-card border border-surface-muted/30 bg-surface-base/35 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Perfil estructurado de dolor abdominal</p>
              <p className="mt-1 text-sm text-ink-secondary">
                Úsalo cuando quieras registrar el cuadro gastrointestinal en campos comparables para analítica.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {ABDOMINAL_SYMPTOMS.map((item) => {
              const selected = perfilDolorAbdominal[item.key] === true;
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={readOnly}
                  onClick={() => handleDolorAbdominalToggle(item.key)}
                  className={clsx(
                    'rounded-pill border px-4 py-3 text-left text-sm font-medium transition-colors',
                    selected
                      ? 'border-accent bg-accent/12 text-accent-text'
                      : 'border-surface-muted/30 bg-surface-inset text-ink-secondary hover:border-frame/30 hover:text-ink',
                    readOnly && 'cursor-default',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">¿Asociado a comida?</label>
              <select
                className="form-input"
                value={perfilDolorAbdominal.asociadoComida || ''}
                onChange={(event) => handleDolorAbdominalField('asociadoComida', event.target.value)}
                disabled={readOnly}
              >
                <option value="">Sin registrar</option>
                <option value="SI">Sí</option>
                <option value="NO">No</option>
                <option value="NO_CLARO">No claro</option>
              </select>
            </div>
            <div>
              <SectionFieldHeader
                label="Notas estructuradas del cuadro"
                action={!readOnly ? (
                  <VoiceDictationButton
                    onTranscript={(text) =>
                      handleDolorAbdominalField('notas', `${perfilDolorAbdominal.notas ? `${perfilDolorAbdominal.notas} ` : ''}${text}`.trim())
                    }
                  />
                ) : undefined}
              />
              <textarea
                value={perfilDolorAbdominal.notas || ''}
                onChange={(event) => handleDolorAbdominalField('notas', event.target.value)}
                disabled={readOnly}
                rows={3}
                className="form-input form-textarea"
                placeholder="Ej: postprandial, tipo cólico, asociado a comidas grasas"
              />
            </div>
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
