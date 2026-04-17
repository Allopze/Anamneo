'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { ConditionSuggestion, MotivoConsultaData, Encounter } from '@/types';
import { FiInfo, FiCheck, FiSearch } from 'react-icons/fi';
import clsx from 'clsx';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionCallout, SectionFieldHeader } from '@/components/sections/SectionPrimitives';

interface Props {
  data: MotivoConsultaData;
  onChange: (data: MotivoConsultaData) => void;
  encounter: Encounter;
  readOnly?: boolean;
}

export default function MotivoConsultaSection({ data, onChange, encounter, readOnly }: Props) {
  const [suggestions, setSuggestions] = useState<ConditionSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const dataRef = useRef(data);
  dataRef.current = data;
  const lastSearchedText = useRef<string>('');

  const persistSuggestionChoice = useCallback(
    (payload: { chosenConditionId: string | null; chosenMode: 'AUTO' | 'MANUAL' }) => {
      api
        .post(`/conditions/encounters/${encounter.id}/suggestion`, {
          inputText: dataRef.current.texto || '',
          persistedTextSnapshot: dataRef.current.texto || '',
          suggestions,
          chosenConditionId: payload.chosenConditionId,
          chosenMode: payload.chosenMode,
        })
        .catch(console.error);
    },
    [encounter.id, suggestions],
  );

  // Debounced search for suggestions
  const searchSuggestions = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length < 3) {
      lastSearchedText.current = '';
      setSuggestions([]);
      return;
    }
    if (text === lastSearchedText.current) return;

    timerRef.current = setTimeout(async () => {
      lastSearchedText.current = text;
      setIsSearching(true);
      try {
        const response = await api.post('/conditions/suggest', { text, limit: 3 });
        setSuggestions(response.data);

        // Auto-select top suggestion only when the user has not explicitly forced manual mode.
        if (
          response.data.length > 0
          && !dataRef.current.afeccionSeleccionada
          && dataRef.current.modoSeleccion !== 'MANUAL'
        ) {
          onChangeRef.current({
            ...dataRef.current,
            afeccionSeleccionada: response.data[0],
            modoSeleccion: 'AUTO',
          });
        }
      } catch (error) {
        console.error('Error searching suggestions:', error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (data.texto) {
      searchSuggestions(data.texto);
    }
  }, [data.texto, searchSuggestions]);

  const handleTextChange = (texto: string) => {
    if (data.modoSeleccion === 'AUTO' && data.afeccionSeleccionada) {
      onChange({
        ...data,
        texto,
        afeccionSeleccionada: null,
        modoSeleccion: undefined,
      });
      return;
    }

    onChange({ ...data, texto });
  };

  const handleSelectCondition = (condition: ConditionSuggestion) => {
    onChange({
      ...data,
      afeccionSeleccionada: condition,
      modoSeleccion: 'AUTO',
    });

    persistSuggestionChoice({ chosenConditionId: condition.id, chosenMode: 'AUTO' });
  };

  const handleManualSelection = () => {
    onChange({
      ...data,
      modoSeleccion: 'MANUAL',
      afeccionSeleccionada: null,
    });

    persistSuggestionChoice({ chosenConditionId: null, chosenMode: 'MANUAL' });
  };

  return (
    <div className="space-y-5">
      <SectionBlock title="Relato principal">
        <SectionFieldHeader
          label="Describa el motivo de consulta del paciente"
          action={
            !readOnly ? (
              <VoiceDictationButton
                onTranscript={(text) => handleTextChange(`${data.texto ? `${data.texto} ` : ''}${text}`.trim())}
              />
            ) : undefined
          }
        />
        <textarea
          value={data.texto || ''}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={readOnly}
          rows={6}
          className="form-input form-textarea"
          placeholder="Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz..."
        />
      </SectionBlock>

      <SectionBlock
        title="Sugerencias de afección"
        muted
        actions={isSearching ? <span className="text-xs text-ink-muted animate-pulse">Buscando...</span> : undefined}
      >
        <div className="mb-3 flex items-center gap-2 text-ink-secondary">
          <FiSearch className="w-4 h-4" />
          <span className="text-sm font-medium">Coincidencias detectadas</span>
        </div>

        {suggestions.length > 0 ? (
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSelectCondition(suggestion)}
                disabled={readOnly}
                className={clsx(
                  'section-item-card w-full flex items-center justify-between text-left',
                  data.afeccionSeleccionada?.id === suggestion.id
                    ? 'section-item-card-selected'
                    : 'hover:border-accent/60',
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      data.afeccionSeleccionada?.id === suggestion.id
                        ? 'bg-accent/100 text-white'
                        : 'bg-surface-muted text-ink-secondary',
                    )}
                  >
                    {data.afeccionSeleccionada?.id === suggestion.id ? (
                      <FiCheck className="w-4 h-4" />
                    ) : (
                      `${suggestion.confidence}%`
                    )}
                  </div>
                  <span className="font-medium text-ink-primary">{suggestion.name}</span>
                </div>
                {!readOnly && <span className="text-sm text-accent-text">Usar esta</span>}
              </button>
            ))}
          </div>
        ) : data.texto && data.texto.length >= 3 ? (
          <p className="text-sm text-ink-muted">No se encontraron sugerencias para el texto ingresado.</p>
        ) : (
          <p className="text-sm text-ink-muted">Escribe al menos 3 caracteres para ver sugerencias.</p>
        )}

        {suggestions.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {suggestions.map((suggestion) => (
              suggestion.reasons && suggestion.reasons.length > 0 ? (
                <div key={`${suggestion.id}-reasons`} className="rounded-input border border-surface-muted/30 bg-surface-base/45 px-3 py-2 text-xs text-ink-secondary">
                  <p className="font-medium text-ink">Por qué aparece {suggestion.name}</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {suggestion.reasons.map((reason) => (
                      <p key={`${suggestion.id}-${reason.kind}-${reason.matchedValue}`}>
                        <span className="font-medium text-ink">{reason.label}:</span> {reason.matchedValue}
                        {reason.matches.length > 0 ? ` · coincide con ${reason.matches.join(', ')}` : ''}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null
            ))}
          </div>
        ) : null}

        {/* Manual selection option */}
        {suggestions.length > 0 && !readOnly && (
          <button
            onClick={handleManualSelection}
            className={clsx(
              'mt-3 w-full rounded-xl border border-dashed p-3 text-left transition-colors',
              data.modoSeleccion === 'MANUAL'
                ? 'border-status-yellow bg-status-yellow/10'
                : 'border-dashed border-surface-muted/30 hover:border-surface-muted/40',
            )}
          >
            <span className="text-sm text-ink-secondary">Ninguna coincide exactamente. Mantener selección manual.</span>
          </button>
        )}

        <div className="mt-4">
          <SectionCallout tone="subtle">
            <div className="flex items-start gap-2 text-xs">
              <FiInfo className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                Sugerencia automática para clasificación; requiere criterio clínico. Las sugerencias son solo para
                organización, no constituyen un diagnóstico.
              </p>
            </div>
          </SectionCallout>
        </div>
      </SectionBlock>

      {data.afeccionSeleccionada && (
        <SectionCallout tone="info" title="Afección seleccionada">
          <p>
            <strong>{data.afeccionSeleccionada.name}</strong>
            <span className="ml-2 text-xs">({data.modoSeleccion === 'AUTO' ? 'Automático' : 'Manual'})</span>
          </p>
        </SectionCallout>
      )}
    </div>
  );
}
