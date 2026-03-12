'use client';

import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import { SospechaDiagnosticaData, SospechaDiagnostica } from '@/types';

interface Props {
  data: SospechaDiagnosticaData;
  onChange: (data: SospechaDiagnosticaData) => void;
  readOnly?: boolean;
}

export default function SospechaDiagnosticaSection({ data, onChange, readOnly }: Props) {
  const sospechas: SospechaDiagnostica[] = data.sospechas || [];

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
    <div className="space-y-4">
      <p className="text-sm text-slate-600 mb-4">
        Agregue las sospechas diagnósticas ordenadas por prioridad (la primera es la principal).
      </p>

      {sospechas.map((sospecha, index) => (
        <div
          key={sospecha.id}
          className="p-4 bg-white border border-slate-200 rounded-lg space-y-3"
        >
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-medium text-sm">
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
                <button
                  type="button"
                  onClick={() => moveSospecha(sospecha.id, 'up')}
                  disabled={index === 0}
                  className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-30"
                >
                  <FiArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSospecha(sospecha.id, 'down')}
                  disabled={index === sospechas.length - 1}
                  className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-30"
                >
                  <FiArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSospecha(sospecha.id)}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <textarea
            value={sospecha.notas}
            onChange={(e) => updateSospecha(sospecha.id, 'notas', e.target.value)}
            disabled={readOnly}
            rows={2}
            className="form-input resize-none"
            placeholder="Notas sobre esta sospecha diagnóstica..."
          />
        </div>
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={addSospecha}
          className="w-full p-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-primary-400 hover:text-primary-600 transition-colors flex items-center justify-center gap-2"
        >
          <FiPlus className="w-4 h-4" />
          Agregar sospecha diagnóstica
        </button>
      )}

      {sospechas.length === 0 && readOnly && (
        <p className="text-center text-slate-500 py-4">
          No se registraron sospechas diagnósticas.
        </p>
      )}
    </div>
  );
}
