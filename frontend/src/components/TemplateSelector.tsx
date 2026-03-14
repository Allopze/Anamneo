'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FiCheck, FiChevronDown, FiEye, FiFileText } from 'react-icons/fi';

interface TemplateSelectorProps {
  sectionKey?: string;
  onInsert: (content: string) => void;
}

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  sectionKey: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  SOAP: 'SOAP',
  CONTROL_CRONICO: 'Control crónico',
  DERIVACION: 'Derivación',
  RECETA: 'Receta',
};

const SECTION_LABELS: Record<string, string> = {
  MOTIVO_CONSULTA: 'Motivo de consulta',
  ANAMNESIS_PROXIMA: 'Anamnesis próxima',
  TRATAMIENTO: 'Tratamiento',
  RESPUESTA_TRATAMIENTO: 'Respuesta al tratamiento',
  OBSERVACIONES: 'Observaciones',
};

export default function TemplateSelector({ sectionKey, onInsert }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  const { data: templates } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: async () => {
      const res = await api.get('/templates');
      return res.data;
    },
    staleTime: 60_000,
  });

  const filtered = templates?.filter(
    (t) => !sectionKey || !t.sectionKey || t.sectionKey === sectionKey,
  ) || [];

  const previewTemplate = useMemo(() => {
    if (filtered.length === 0) return null;
    if (!previewTemplateId) return filtered[0];
    return filtered.find((template) => template.id === previewTemplateId) || filtered[0];
  }, [filtered, previewTemplateId]);

  useEffect(() => {
    if (!open) return;
    setPreviewTemplateId((current) => {
      if (current && filtered.some((template) => template.id === current)) {
        return current;
      }
      return filtered[0]?.id ?? null;
    });
  }, [filtered, open]);

  if (filtered.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
      >
        <FiFileText className="w-3.5 h-3.5" />
        Insertar plantilla
        <FiChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 left-0 top-full mt-2 w-[min(42rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-[16rem,1fr]">
            <div className="max-h-80 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200">
              {filtered.map((template) => {
                const isActive = template.id === previewTemplate?.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setPreviewTemplateId(template.id)}
                    className={`w-full text-left px-4 py-3 transition-colors border-b border-slate-100 last:border-b-0 ${
                      isActive ? 'bg-primary-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900 truncate">{template.name}</div>
                      {isActive && <FiEye className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </span>
                      {template.sectionKey && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                          {SECTION_LABELS[template.sectionKey] || template.sectionKey}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {previewTemplate && (
              <div className="p-4 flex flex-col gap-4 max-h-80">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{previewTemplate.name}</div>
                    <p className="text-xs text-slate-500">
                      Vista previa antes de insertar en la sección actual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onInsert(previewTemplate.content);
                      setOpen(false);
                    }}
                    className="btn btn-primary text-sm flex items-center gap-2"
                  >
                    <FiCheck className="w-4 h-4" />
                    Insertar
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-y-auto">
                  <pre className="whitespace-pre-wrap break-words text-sm text-slate-700 font-sans">
                    {previewTemplate.content}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
