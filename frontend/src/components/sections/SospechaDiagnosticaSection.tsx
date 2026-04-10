'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown, FiSearch } from 'react-icons/fi';
import { ConditionSuggestion, MotivoConsultaData, SospechaDiagnosticaData, SospechaDiagnostica } from '@/types';
import { SectionAddButton, SectionBlock, SectionIconButton } from '@/components/sections/SectionPrimitives';
import { api } from '@/lib/api';

interface Props {
  data: SospechaDiagnosticaData;
  onChange: (data: SospechaDiagnosticaData) => void;
  readOnly?: boolean;
  motivoConsultaData?: MotivoConsultaData;
}

export default function SospechaDiagnosticaSection({ data, onChange, readOnly, motivoConsultaData }: Props) {
  const sospechas: SospechaDiagnostica[] = data.sospechas || [];
  const didSeedRef = useRef(false);
  const [cie10Query, setCie10Query] = useState<Record<string, string>>({});
  const [cie10Results, setCie10Results] = useState<Record<string, Array<{ code: string; description: string }>>>({});
  const cie10TimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const searchCie10 = useCallback(async (sospechaId: string, query: string) => {
    setCie10Query((prev) => ({ ...prev, [sospechaId]: query }));
    if (cie10TimerRef.current[sospechaId]) clearTimeout(cie10TimerRef.current[sospechaId]);
    if (query.trim().length < 2) {
      setCie10Results((prev) => ({ ...prev, [sospechaId]: [] }));
      return;
    }
    cie10TimerRef.current[sospechaId] = setTimeout(async () => {
      try {
        const res = await api.get('/cie10/search', { params: { q: query, limit: 8 } });
        setCie10Results((prev) => ({ ...prev, [sospechaId]: res.data }));
      } catch {
        setCie10Results((prev) => ({ ...prev, [sospechaId]: [] }));
      }
    }, 300);
  }, []);

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
      <SectionBlock title="Sospechas diagnósticas">
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

              {/* CIE-10 code */}
              <div className="space-y-1">
                {sospecha.codigoCie10 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded border border-accent-border bg-accent-subtle px-2 py-0.5 font-mono text-xs font-medium text-accent-text">
                      {sospecha.codigoCie10}
                    </span>
                    <span className="text-ink-muted">{sospecha.descripcionCie10}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = sospechas.map((s) =>
                            s.id === sospecha.id ? { ...s, codigoCie10: undefined, descripcionCie10: undefined } : s
                          );
                          onChange({ ...data, sospechas: updated });
                        }}
                        className="text-xs text-ink-muted hover:text-red-600"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ) : !readOnly ? (
                  <div className="relative">
                    <div className="flex items-center gap-1">
                      <FiSearch className="h-3.5 w-3.5 text-ink-muted" />
                      <input
                        type="text"
                        value={cie10Query[sospecha.id] || ''}
                        onChange={(e) => searchCie10(sospecha.id, e.target.value)}
                        className="form-input text-sm py-1"
                        placeholder="Buscar código CIE-10..."
                      />
                    </div>
                    {(cie10Results[sospecha.id]?.length ?? 0) > 0 && (
                      <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
                        {cie10Results[sospecha.id].map((entry) => (
                          <li key={entry.code}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
                              onClick={() => {
                                const updated = sospechas.map((s) =>
                                  s.id === sospecha.id
                                    ? { ...s, codigoCie10: entry.code, descripcionCie10: entry.description }
                                    : s
                                );
                                onChange({ ...data, sospechas: updated });
                                setCie10Query((prev) => ({ ...prev, [sospecha.id]: '' }));
                                setCie10Results((prev) => ({ ...prev, [sospecha.id]: [] }));
                              }}
                            >
                              <span className="font-mono text-xs font-medium text-accent-text">{entry.code}</span>
                              <span className="text-ink-muted truncate">{entry.description}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
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
