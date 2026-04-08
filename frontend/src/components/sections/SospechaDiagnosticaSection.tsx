'use client';

import { useEffect, useRef } from 'react';
import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { ConditionSuggestion, MotivoConsultaData, SospechaDiagnosticaData, SospechaDiagnostica } from '@/types';
import { SectionAddButton, SectionBlock, SectionIconButton, SectionIntro } from '@/components/sections/SectionPrimitives';

interface Props {
  data: SospechaDiagnosticaData;
  onChange: (data: SospechaDiagnosticaData) => void;
  readOnly?: boolean;
  motivoConsultaData?: MotivoConsultaData;
}

export default function SospechaDiagnosticaSection({ data, onChange, readOnly, motivoConsultaData }: Props) {
  const sospechas: SospechaDiagnostica[] = data.sospechas || [];
  const didSeedRef = useRef(false);

  // Pre-load the selected condition from Motivo de Consulta as first diagnostic suspicion
  useEffect(() => {
    if (didSeedRef.current) return;
    if (readOnly) return;
    if (sospechas.length > 0) return;
    const afeccion = motivoConsultaData?.afeccionSeleccionada;
    if (!afeccion?.name) return;

    didSeedRef.current = true;
    onChange({
      ...data,
      sospechas: [
        {
          id: Date.now().toString(),
          diagnostico: afeccion.name,
          prioridad: 1,
          notas: `Sugerida automáticamente desde motivo de consulta (confianza: ${Math.round((afeccion.confidence ?? 0) * 100)}%)`,
        },
      ],
    });
  }, [data, motivoConsultaData?.afeccionSeleccionada, onChange, readOnly, sospechas.length]);

  const addSospecha = () => {
    const newSospecha: SospechaDiagnostica = {
      id: Date.now().toString(),
      diagnostico: '',
      prioridad: sospechas.length + 1,
      notas: '',
    };
    onChange({ ...data, sospechas: [...sospechas, newSospecha] });
  };

  const updateSospecha = (id: string, field: keyof SospechaDiagnostica, value: any) => {
    const updated = sospechas.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    onChange({ ...data, sospechas: updated });
  };

  const removeSospecha = (id: string) => {
    const updated = sospechas.filter((s) => s.id !== id);
    // Recalculate priorities
    const reordered = updated.map((s, i) => ({ ...s, prioridad: i + 1 }));
    onChange({ ...data, sospechas: reordered });
  };

  const moveSospecha = (id: string, direction: 'up' | 'down') => {
    const index = sospechas.findIndex((s) => s.id === id);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === sospechas.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...sospechas];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    
    // Recalculate priorities
    const reordered = updated.map((s, i) => ({ ...s, prioridad: i + 1 }));
    onChange({ ...data, sospechas: reordered });
  };

  return (
    <div className="space-y-5">
      <SectionIntro description="Ordena las hipótesis diagnósticas por prioridad clínica. La primera corresponde a la principal." />

      <SectionBlock title="Sospechas diagnósticas" description="Lista priorizada para apoyar el razonamiento clínico y el seguimiento.">
        <div className="space-y-3">
          {sospechas.map((sospecha, index) => (
            <div
              key={sospecha.id}
              className="section-item-card space-y-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-status-yellow/65 bg-status-yellow/35 text-sm font-medium text-accent-text">
                  {sospecha.prioridad}
                </span>

                <input
                  type="text"
                  value={sospecha.diagnostico}
                  onChange={(e) => updateSospecha(sospecha.id, 'diagnostico', e.target.value)}
                  disabled={readOnly}
                  className="form-input flex-1"
                  placeholder="Diagnóstico sospechado..."
                />

                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <SectionIconButton
                      onClick={() => moveSospecha(sospecha.id, 'up')}
                      disabled={index === 0}
                      ariaLabel="Mover arriba"
                    >
                      <FiArrowUp className="w-4 h-4" />
                    </SectionIconButton>
                    <SectionIconButton
                      onClick={() => moveSospecha(sospecha.id, 'down')}
                      disabled={index === sospechas.length - 1}
                      ariaLabel="Mover abajo"
                    >
                      <FiArrowDown className="w-4 h-4" />
                    </SectionIconButton>
                    <SectionIconButton
                      onClick={() => removeSospecha(sospecha.id)}
                      tone="danger"
                      ariaLabel="Eliminar sospecha"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </SectionIconButton>
                  </div>
                )}
              </div>

              <textarea
                value={sospecha.notas}
                onChange={(e) => updateSospecha(sospecha.id, 'notas', e.target.value)}
                disabled={readOnly}
                rows={2}
                className="form-input form-textarea"
                placeholder="Notas sobre esta sospecha diagnóstica..."
              />
            </div>
          ))}

          {!readOnly && (
            <SectionAddButton onClick={addSospecha}>
              <FiPlus className="w-4 h-4" />
              Agregar sospecha diagnóstica
            </SectionAddButton>
          )}

          {sospechas.length === 0 && readOnly && (
            <p className="py-4 text-center text-ink-muted">
              No se registraron sospechas diagnósticas.
            </p>
          )}
        </div>
      </SectionBlock>
    </div>
  );
}
