'use client';

import {
  EstadoAdherenciaTratamiento,
  EstadoRespuestaTratamiento,
  RespuestaTratamientoData,
  SeveridadEventoAdversoTratamiento,
  TratamientoData,
} from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionFieldHeader } from '@/components/sections/SectionPrimitives';

const RESPONSE_OUTCOME_OPTIONS = [
  { value: 'FAVORABLE', label: 'Favorable' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'SIN_RESPUESTA', label: 'Sin respuesta' },
  { value: 'EMPEORA', label: 'Empeora' },
] as const;

const ADHERENCE_OPTIONS = [
  { value: 'ADHERENTE', label: 'Adherente' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'NO_ADHERENTE', label: 'No adherente' },
] as const;

const ADVERSE_EVENT_OPTIONS = [
  { value: 'LEVE', label: 'Leve' },
  { value: 'MODERADO', label: 'Moderado' },
  { value: 'SEVERO', label: 'Severo' },
] as const;

interface Props {
  data: RespuestaTratamientoData;
  onChange: (data: RespuestaTratamientoData) => void;
  readOnly?: boolean;
  treatmentData?: TratamientoData;
}

export default function RespuestaTratamientoSection({ data, onChange, readOnly, treatmentData }: Props) {
  const handleChange = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const respuestaEstructurada = data.respuestaEstructurada || {};
  const resultadosTratamientos = data.resultadosTratamientos || [];
  const treatmentRows = [
    ...(treatmentData?.medicamentosEstructurados || []).map((item) => ({
      id: item.id,
      label: item.nombre?.trim() || item.activeIngredient?.trim() || 'Medicamento sin nombre',
      typeLabel: 'Medicamento',
    })),
    ...(treatmentData?.examenesEstructurados || []).map((item) => ({
      id: item.id,
      label: item.nombre?.trim() || 'Examen sin nombre',
      typeLabel: 'Examen',
    })),
    ...(treatmentData?.derivacionesEstructuradas || []).map((item) => ({
      id: item.id,
      label: item.nombre?.trim() || 'Derivación sin nombre',
      typeLabel: 'Derivación',
    })),
  ];

  const handleStructuredOutcomeChange = (field: 'estado' | 'notas', value: string) => {
    handleChange('respuestaEstructurada', {
      ...respuestaEstructurada,
      [field]: value,
    });
  };

  const updateTreatmentOutcome = (
    treatmentItemId: string,
    patch: {
      estado?: EstadoRespuestaTratamiento;
      notas?: string;
      adherenceStatus?: EstadoAdherenciaTratamiento;
      adverseEventSeverity?: SeveridadEventoAdversoTratamiento;
      adverseEventNotes?: string;
    },
  ) => {
    const next = [...resultadosTratamientos];
    const index = next.findIndex((entry) => entry.treatmentItemId === treatmentItemId);
    const current = index >= 0 ? next[index] : { treatmentItemId };
    const merged = { ...current, ...patch };
    const hasNotes = typeof merged.notas === 'string' && merged.notas.trim().length > 0;
    const hasAdverseEventNotes = typeof merged.adverseEventNotes === 'string' && merged.adverseEventNotes.trim().length > 0;

    if (!merged.estado && !hasNotes && !merged.adherenceStatus && !merged.adverseEventSeverity && !hasAdverseEventNotes) {
      const filtered = next.filter((entry) => entry.treatmentItemId !== treatmentItemId);
      handleChange('resultadosTratamientos', filtered.length > 0 ? filtered : undefined);
      return;
    }

    const normalized = {
      treatmentItemId,
      ...(merged.estado ? { estado: merged.estado } : {}),
      ...(typeof merged.notas === 'string' ? { notas: merged.notas } : {}),
      ...(merged.adherenceStatus ? { adherenceStatus: merged.adherenceStatus } : {}),
      ...(merged.adverseEventSeverity ? { adverseEventSeverity: merged.adverseEventSeverity } : {}),
      ...(typeof merged.adverseEventNotes === 'string' ? { adverseEventNotes: merged.adverseEventNotes } : {}),
    };

    if (index >= 0) {
      next[index] = normalized;
    } else {
      next.push(normalized);
    }

    handleChange('resultadosTratamientos', next);
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Desenlace por tratamiento u orden">
        <div className="space-y-4">
          {treatmentRows.length > 0 ? (
            treatmentRows.map((item) => {
              const current = resultadosTratamientos.find((entry) => entry.treatmentItemId === item.id);

              return (
                <div key={item.id} className="rounded-card border border-surface-muted/30 bg-surface-base/35 p-4">
                  <p className="mb-3 text-sm font-medium text-ink-primary">{item.typeLabel}: {item.label}</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="form-label">Desenlace estructurado</label>
                      <select
                        value={current?.estado || ''}
                        onChange={(event) =>
                          updateTreatmentOutcome(item.id, {
                            estado: (event.target.value || undefined) as EstadoRespuestaTratamiento | undefined,
                          })
                        }
                        disabled={readOnly}
                        className="form-input"
                        aria-label={`Desenlace estructurado de ${item.typeLabel.toLowerCase()} ${item.label}`}
                      >
                        <option value="">Sin registrar</option>
                        {RESPONSE_OUTCOME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <SectionFieldHeader
                        label="Notas del desenlace"
                        action={!readOnly ? (
                          <VoiceDictationButton
                            onTranscript={(text) =>
                              updateTreatmentOutcome(item.id, {
                                notas: `${current?.notas ? `${current.notas} ` : ''}${text}`.trim(),
                              })
                            }
                          />
                        ) : undefined}
                      />
                      <textarea
                        value={current?.notas || ''}
                        onChange={(event) => updateTreatmentOutcome(item.id, { notas: event.target.value })}
                        disabled={readOnly}
                        rows={2}
                        className="form-input form-textarea"
                        placeholder="Observaciones específicas para este tratamiento u orden..."
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="form-label">Adherencia</label>
                      <select
                        value={current?.adherenceStatus || ''}
                        onChange={(event) =>
                          updateTreatmentOutcome(item.id, {
                            adherenceStatus: (event.target.value || undefined) as EstadoAdherenciaTratamiento | undefined,
                          })
                        }
                        disabled={readOnly}
                        className="form-input"
                        aria-label={`Adherencia de ${item.typeLabel.toLowerCase()} ${item.label}`}
                      >
                        <option value="">Sin registrar</option>
                        {ADHERENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Evento adverso</label>
                      <select
                        value={current?.adverseEventSeverity || ''}
                        onChange={(event) =>
                          updateTreatmentOutcome(item.id, {
                            adverseEventSeverity: (event.target.value || undefined) as SeveridadEventoAdversoTratamiento | undefined,
                          })
                        }
                        disabled={readOnly}
                        className="form-input"
                        aria-label={`Evento adverso de ${item.typeLabel.toLowerCase()} ${item.label}`}
                      >
                        <option value="">Sin registrar</option>
                        {ADVERSE_EVENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <SectionFieldHeader
                      label="Notas de adherencia o evento adverso"
                      action={!readOnly ? (
                        <VoiceDictationButton
                          onTranscript={(text) =>
                            updateTreatmentOutcome(item.id, {
                              adverseEventNotes: `${current?.adverseEventNotes ? `${current.adverseEventNotes} ` : ''}${text}`.trim(),
                            })
                          }
                        />
                      ) : undefined}
                    />
                    <textarea
                      value={current?.adverseEventNotes || ''}
                      onChange={(event) => updateTreatmentOutcome(item.id, { adverseEventNotes: event.target.value })}
                      disabled={readOnly}
                      rows={2}
                      className="form-input form-textarea"
                      placeholder="Ej: olvidos frecuentes, suspendió dosis por náuseas, mareos leves..."
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-ink-secondary">
              Agrega medicamentos, exámenes o derivaciones estructuradas en la sección de tratamiento para registrar desenlaces por ítem.
            </p>
          )}
        </div>
      </SectionBlock>

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
                  Este campo queda como respaldo global cuando no se registran desenlaces por tratamiento u orden.
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
