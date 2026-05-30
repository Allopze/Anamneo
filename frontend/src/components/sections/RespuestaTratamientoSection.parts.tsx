'use client';

/**
 * Sub-components for RespuestaTratamientoSection.
 * Not exported from the public barrel.
 */

import {
  EstadoAdherenciaTratamiento,
  EstadoRespuestaTratamiento,
  SeveridadEventoAdversoTratamiento,
  StructuredTreatmentResponse,
} from '@/types';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionFieldHeader } from '@/components/sections/SectionPrimitives';

export const RESPONSE_OUTCOME_OPTIONS = [
  { value: 'FAVORABLE', label: 'Favorable' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'SIN_RESPUESTA', label: 'Sin respuesta' },
  { value: 'EMPEORA', label: 'Empeora' },
] as const;

export const ADHERENCE_OPTIONS = [
  { value: 'ADHERENTE', label: 'Adherente' },
  { value: 'PARCIAL', label: 'Parcial' },
  { value: 'NO_ADHERENTE', label: 'No adherente' },
] as const;

export const ADVERSE_EVENT_OPTIONS = [
  { value: 'LEVE', label: 'Leve' },
  { value: 'MODERADO', label: 'Moderado' },
  { value: 'SEVERO', label: 'Severo' },
] as const;

interface TreatmentOutcomeRowProps {
  item: { id: string; label: string; typeLabel: string };
  current?: StructuredTreatmentResponse;
  readOnly?: boolean;
  onUpdate: (
    treatmentItemId: string,
    patch: {
      estado?: EstadoRespuestaTratamiento;
      notas?: string;
      adherenceStatus?: EstadoAdherenciaTratamiento;
      adverseEventSeverity?: SeveridadEventoAdversoTratamiento;
      adverseEventNotes?: string;
    },
  ) => void;
}

/** Per-treatment-item outcome card rendered inside "Desenlace por tratamiento u orden". */
export function TreatmentOutcomeRow({ item, current, readOnly, onUpdate }: TreatmentOutcomeRowProps) {
  return (
    <div className="rounded-card border border-surface-muted/30 bg-surface-base/35 p-4">
      <p className="mb-3 text-sm font-medium text-ink-primary">
        {item.typeLabel}: {item.label}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="form-label">Desenlace estructurado</label>
          <select
            value={current?.estado || ''}
            onChange={(event) =>
              onUpdate(item.id, {
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
            action={
              !readOnly ? (
                <VoiceDictationButton
                  onTranscript={(text) =>
                    onUpdate(item.id, {
                      notas: `${current?.notas ? `${current.notas} ` : ''}${text}`.trim(),
                    })
                  }
                />
              ) : undefined
            }
          />
          <textarea
            value={current?.notas || ''}
            onChange={(event) => onUpdate(item.id, { notas: event.target.value })}
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
              onUpdate(item.id, {
                adherenceStatus: (event.target.value ||
                  undefined) as EstadoAdherenciaTratamiento | undefined,
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
              onUpdate(item.id, {
                adverseEventSeverity: (event.target.value ||
                  undefined) as SeveridadEventoAdversoTratamiento | undefined,
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
          action={
            !readOnly ? (
              <VoiceDictationButton
                onTranscript={(text) =>
                  onUpdate(item.id, {
                    adverseEventNotes: `${current?.adverseEventNotes ? `${current.adverseEventNotes} ` : ''}${text}`.trim(),
                  })
                }
              />
            ) : undefined
          }
        />
        <textarea
          value={current?.adverseEventNotes || ''}
          onChange={(event) => onUpdate(item.id, { adverseEventNotes: event.target.value })}
          disabled={readOnly}
          rows={2}
          className="form-input form-textarea"
          placeholder="Ej: olvidos frecuentes, suspendió dosis por náuseas, mareos leves..."
        />
      </div>
    </div>
  );
}
