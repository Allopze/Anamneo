'use client';

import { RespuestaTratamientoData } from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionFieldHeader } from '@/components/sections/SectionPrimitives';

const RESPONSE_OUTCOME_OPTIONS = [
  { value: 'FAVORABLE', label: 'Favorable' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'SIN_RESPUESTA', label: 'Sin respuesta' },
  { value: 'EMPEORA', label: 'Empeora' },
] as const;

interface Props {
  data: RespuestaTratamientoData;
  onChange: (data: RespuestaTratamientoData) => void;
  readOnly?: boolean;
}

export default function RespuestaTratamientoSection({ data, onChange, readOnly }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const respuestaEstructurada = data.respuestaEstructurada || {};

  const handleStructuredOutcomeChange = (field: 'estado' | 'notas', value: string) => {
    handleChange('respuestaEstructurada', {
      ...respuestaEstructurada,
      [field]: value,
    });
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Respuesta clínica">
        <div className="space-y-4">
          <div className="rounded-card border border-surface-muted/30 bg-surface-base/35 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">Desenlace estructurado</label>
                <select
                  value={respuestaEstructurada.estado || ''}
                  onChange={(event) => handleStructuredOutcomeChange('estado', event.target.value)}
                  disabled={readOnly}
                  className="form-input"
                >
                  <option value="">Sin registrar</option>
                  {RESPONSE_OUTCOME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-ink-secondary">
                  Este campo es el que la analítica usa primero para estimar si el tratamiento funcionó.
                </p>
              </div>

              <div>
                <SectionFieldHeader
                  label="Notas del desenlace estructurado"
                  action={!readOnly ? (
                    <VoiceDictationButton
                      onTranscript={(text) =>
                        handleStructuredOutcomeChange('notas', `${respuestaEstructurada.notas ? `${respuestaEstructurada.notas} ` : ''}${text}`.trim())
                      }
                    />
                  ) : undefined}
                />
                <textarea
                  value={respuestaEstructurada.notas || ''}
                  onChange={(event) => handleStructuredOutcomeChange('notas', event.target.value)}
                  disabled={readOnly}
                  rows={3}
                  className="form-input form-textarea"
                  placeholder="Ej: dolor resuelto, tolera alimentación, sin nuevos vómitos"
                />
              </div>
            </div>
          </div>

          <div>
            <SectionFieldHeader
              label="Evolución con el tratamiento"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) => handleChange('evolucion', `${data.evolucion ? `${data.evolucion} ` : ''}${text}`.trim())}
                />
              ) : undefined}
            />
            <textarea
              value={data.evolucion || ''}
              onChange={(e) => handleChange('evolucion', e.target.value)}
              disabled={readOnly}
              rows={4}
              className="form-input form-textarea"
              placeholder=""
            />
          </div>

          <div>
            <SectionFieldHeader
              label="Resultados de exámenes"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('resultadosExamenes', `${data.resultadosExamenes ? `${data.resultadosExamenes} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.resultadosExamenes || ''}
              onChange={(e) => handleChange('resultadosExamenes', e.target.value)}
              disabled={readOnly}
              rows={3}
              className="form-input form-textarea"
              placeholder="Resultados relevantes de exámenes solicitados..."
            />
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Ajustes y seguimiento">
        <div className="space-y-4">
          <div>
            <SectionFieldHeader
              label="Ajustes al tratamiento"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('ajustesTratamiento', `${data.ajustesTratamiento ? `${data.ajustesTratamiento} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.ajustesTratamiento || ''}
              onChange={(e) => handleChange('ajustesTratamiento', e.target.value)}
              disabled={readOnly}
              rows={3}
              className="form-input form-textarea"
              placeholder="Cambios realizados al plan de tratamiento inicial..."
            />
          </div>

          <div>
            <SectionFieldHeader
              label="Plan de seguimiento"
              action={!readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    handleChange('planSeguimiento', `${data.planSeguimiento ? `${data.planSeguimiento} ` : ''}${text}`.trim())
                  }
                />
              ) : undefined}
            />
            <textarea
              value={data.planSeguimiento || ''}
              onChange={(e) => handleChange('planSeguimiento', e.target.value)}
              disabled={readOnly}
              rows={3}
              className="form-input form-textarea"
              placeholder="Próximos controles, indicaciones de seguimiento..."
            />
          </div>
        </div>
      </SectionBlock>
    </div>
  );
}
