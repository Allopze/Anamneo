'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { ConditionSuggestion, MotivoConsultaData, Encounter } from '@/types';
import { FiInfo, FiCheck, FiSearch } from 'react-icons/fi';
import clsx from 'clsx';
import VoiceDictationButton from '@/components/common/VoiceDictationButton';
import { SectionBlock, SectionCallout, SectionFieldHeader, SectionIntro } from '@/components/sections/SectionPrimitives';

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

  // Debounced search for suggestions
  const searchSuggestions = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.length < 3) {
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

        // Auto-select top suggestion if none selected
        if (response.data.length > 0 && !dataRef.current.afeccionSeleccionada) {
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
    onChange({ ...data, texto });
  };

  const handleSelectCondition = (condition: ConditionSuggestion) => {
    onChange({
      ...data,
      afeccionSeleccionada: condition,
      modoSeleccion: 'AUTO',
    });
    
    // Log the selection
    api.post(`/conditions/encounters/${encounter.id}/suggestion`, {
      inputText: data.texto,
      suggestions,
      chosenConditionId: condition.id,
      chosenMode: 'AUTO',
    }).catch(console.error);
  };

  const handleManualSelection = () => {
    onChange({
      ...data,
      modoSeleccion: 'MANUAL',
      afeccionSeleccionada: null,
    });
  };

  return (
    <div className="space-y-5">
      <SectionIntro description="Registra el motivo principal expresado por el paciente. El sistema puede sugerir una afección para clasificar mejor la atención." />

      <SectionBlock title="Relato principal" description="Describe en lenguaje clínico breve y fiel el motivo de consulta.">
        <SectionFieldHeader
          label="Describa el motivo de consulta del paciente"
          action={!readOnly ? (
            <VoiceDictationButton
              onTranscript={(text) => handleTextChange(`${data.texto ? `${data.texto} ` : ''}${text}`.trim())}
            />
          ) : undefined}
        />
        <textarea
          value={data.texto || ''}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={readOnly}
          rows={6}
          className="form-input resize-none"
          placeholder="Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz..."
        />
      </SectionBlock>

      <SectionBlock
        title="Sugerencias de afección"
        description="Clasificación asistida para organizar la atención. No reemplaza criterio clínico."
        muted
        actions={isSearching ? <span className="text-xs text-slate-500 animate-pulse">Buscando...</span> : undefined}
      >
        <div className="mb-3 flex items-center gap-2 text-slate-600">
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
                    : 'hover:border-primary-300'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                      data.afeccionSeleccionada?.id === suggestion.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {data.afeccionSeleccionada?.id === suggestion.id ? (
                      <FiCheck className="w-4 h-4" />
                    ) : (
                      `${suggestion.confidence}%`
                    )}
                  </div>
                  <span className="font-medium text-slate-900">{suggestion.name}</span>
                </div>
                {!readOnly && (
                  <span className="text-sm text-primary-600">Usar esta</span>
                )}
              </button>
            ))}
          </div>
        ) : data.texto && data.texto.length >= 3 ? (
          <p className="text-sm text-slate-500">
            No se encontraron sugerencias para el texto ingresado.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Escribe al menos 3 caracteres para ver sugerencias.
          </p>
        )}

        {/* Manual selection option */}
        {suggestions.length > 0 && !readOnly && (
          <button
            onClick={handleManualSelection}
            className={clsx(
              'mt-3 w-full rounded-xl border border-dashed p-3 text-left transition-colors',
              data.modoSeleccion === 'MANUAL'
                ? 'border-amber-500 bg-amber-50'
                : 'border-dashed border-slate-300 hover:border-slate-400'
            )}
          >
            <span className="text-sm text-slate-600">
              Ninguna coincide exactamente. Mantener selección manual.
            </span>
          </button>
        )}

        <div className="mt-4">
          <SectionCallout tone="subtle">
            <div className="flex items-start gap-2 text-xs">
              <FiInfo className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                Sugerencia automática para clasificación; requiere criterio clínico.
                Las sugerencias son solo para organización, no constituyen un diagnóstico.
              </p>
            </div>
          </SectionCallout>
        </div>
      </SectionBlock>

      {data.afeccionSeleccionada && (
        <SectionCallout tone="info" title="Afección seleccionada">
          <p>
            <strong>{data.afeccionSeleccionada.name}</strong>
            <span className="ml-2 text-xs">
              ({data.modoSeleccion === 'AUTO' ? 'Automático' : 'Manual'})
            </span>
          </p>
        </SectionCallout>
      )}
    </div>
  );
}
