'use client';

import { useId } from 'react';
import clsx from 'clsx';
import { AnamnesisProximaData, PerfilDolorAbdominalData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionFieldHeader, SectionIntro } from '@/components/sections/SectionPrimitives';

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
  const baseId = useId();
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const appendTranscript = (currentValue: string | undefined, transcript: string) => {
    return `${currentValue ? `${currentValue} ` : ''}${transcript}`.trim();
  };

  const perfilDolorAbdominal = data.perfilDolorAbdominal || {};
  const relatoId = `${baseId}-relato`;
  const inicioId = `${baseId}-inicio`;
  const evolucionId = `${baseId}-evolucion`;
  const agravantesId = `${baseId}-agravantes`;
  const atenuantesId = `${baseId}-atenuantes`;
  const sintomasId = `${baseId}-sintomas`;
  const comidaId = `${baseId}-comida`;
  const notasId = `${baseId}-notas`;

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
    <div className="space-y-4 lg:space-y-5">
      <SectionIntro description="Primero captura el relato libre y luego sintetiza inicio, evolución y moduladores. Usa el dictado para acelerar el texto narrativo y deja el perfil estructurado para el dolor abdominal cuando aporte valor comparativo." />

      <SectionBlock title="Relato del cuadro actual">
        <SectionFieldHeader
          label="Relato ampliado"
          htmlFor={relatoId}
          hint="Registra el relato principal en lenguaje clínico natural. El campo mantiene scroll interno cuando crece."
          action={!readOnly ? (
            <VoiceDictationButton
              label="Dictar relato"
              onTranscript={(text) => handleChange('relatoAmpliado', appendTranscript(data.relatoAmpliado, text))}
            />
          ) : undefined}
        />
        <textarea
          id={relatoId}
          value={data.relatoAmpliado || ''}
          onChange={(e) => handleChange('relatoAmpliado', e.target.value)}
          disabled={readOnly}
          rows={5}
          className="form-input form-textarea clinical-textarea"
          placeholder="Describe el motivo, la cronología y el contexto clínico en lenguaje libre."
        />
      </SectionBlock>

      <SectionBlock title="Cronología y moduladores">
        <div className="space-y-3 lg:space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:gap-4">
            <div>
              <label htmlFor={inicioId} className="form-label">Inicio</label>
              <input
                id={inicioId}
                type="text"
                value={data.inicio || ''}
                onChange={(e) => handleChange('inicio', e.target.value)}
                disabled={readOnly}
                className="form-input"
                placeholder="Ej: Hace 3 días, súbito"
              />
              <p className="mt-1 text-xs text-ink-muted">Momento de comienzo, gatillante o forma de instalación.</p>
            </div>
            <div>
              <label htmlFor={evolucionId} className="form-label">Evolución</label>
              <input
                id={evolucionId}
                type="text"
                value={data.evolucion || ''}
                onChange={(e) => handleChange('evolucion', e.target.value)}
                disabled={readOnly}
                className="form-input"
                placeholder="Ej: Progresivo, intermitente"
              />
              <p className="mt-1 text-xs text-ink-muted">Cómo ha cambiado desde el inicio y si mantiene patrón estable.</p>
            </div>
          </div>

          <div>
            <SectionFieldHeader
              label="Factores agravantes"
              htmlFor={agravantesId}
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) => handleChange('factoresAgravantes', appendTranscript(data.factoresAgravantes, text))}
                />
              ) : undefined}
            />
            <textarea
              id={agravantesId}
              value={data.factoresAgravantes || ''}
              onChange={(e) => handleChange('factoresAgravantes', e.target.value)}
              disabled={readOnly}
              rows={2}
              className="form-input form-textarea clinical-textarea clinical-textarea-compact"
              placeholder="¿Qué empeora los síntomas?"
            />
          </div>

          <div>
            <SectionFieldHeader
              label="Factores atenuantes"
              htmlFor={atenuantesId}
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) => handleChange('factoresAtenuantes', appendTranscript(data.factoresAtenuantes, text))}
                />
              ) : undefined}
            />
            <textarea
              id={atenuantesId}
              value={data.factoresAtenuantes || ''}
              onChange={(e) => handleChange('factoresAtenuantes', e.target.value)}
              disabled={readOnly}
              rows={2}
              className="form-input form-textarea clinical-textarea clinical-textarea-compact"
              placeholder="¿Qué mejora los síntomas?"
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Síntomas asociados">
        <SectionFieldHeader
          label="Síntomas asociados"
          htmlFor={sintomasId}
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) => handleChange('sintomasAsociados', appendTranscript(data.sintomasAsociados, text))}
            />
          ) : undefined}
        />
        <textarea
          id={sintomasId}
          value={data.sintomasAsociados || ''}
          onChange={(e) => handleChange('sintomasAsociados', e.target.value)}
          disabled={readOnly}
          rows={3}
          className="form-input form-textarea clinical-textarea"
          placeholder=""
        />

        <fieldset className="mt-4 rounded-lg border border-surface-muted/40 bg-surface-base/45 p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Perfil estructurado de dolor abdominal</legend>
          <p className="mt-1 text-sm text-ink-secondary">
            Úsalo cuando quieras registrar el cuadro gastrointestinal en campos comparables para analítica.
          </p>

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
                    'min-h-11 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20',
                    selected
                      ? 'border-frame/30 bg-surface-elevated text-ink'
                      : 'border-surface-muted/30 bg-surface-inset text-ink-secondary hover:border-frame/30 hover:text-ink',
                    readOnly && 'cursor-default',
                  )}
                  aria-pressed={selected}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={comidaId} className="form-label">¿Asociado a comida?</label>
              <select
                id={comidaId}
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
              <p className="mt-1 text-xs text-ink-muted">Ayuda a ordenar el patrón posprandial o funcional.</p>
            </div>
            <div>
              <SectionFieldHeader
                label="Notas estructuradas del cuadro"
                htmlFor={notasId}
                action={!readOnly ? (
                  <VoiceDictationButton
                    onTranscript={(text) => handleDolorAbdominalField('notas', appendTranscript(perfilDolorAbdominal.notas, text))}
                  />
                ) : undefined}
              />
              <textarea
                id={notasId}
                value={perfilDolorAbdominal.notas || ''}
                onChange={(event) => handleDolorAbdominalField('notas', event.target.value)}
                disabled={readOnly}
                rows={3}
                className="form-input form-textarea clinical-textarea"
                placeholder="Ej: postprandial, tipo cólico, asociado a comidas grasas"
              />
            </div>
          </div>
        </fieldset>
      </SectionBlock>
    </div>
  );
}
