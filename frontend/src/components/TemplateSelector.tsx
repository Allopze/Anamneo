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

  const filtered = useMemo(
    () =>
      templates?.filter(
        (t) => !sectionKey || !t.sectionKey || t.sectionKey === sectionKey,
      ) || [],
    [sectionKey, templates],
  );

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
        className="inline-flex items-center gap-2 rounded-xl border border-surface-muted/45 bg-surface-base px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/20"
      >
        <FiFileText className="h-4 w-4 text-ink-secondary" />
        Insertar Plantilla
        <FiChevronDown className={`h-3.5 w-3.5 text-ink-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-2 w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-frame/10 bg-surface-elevated shadow-dropdown">
          <div className="grid md:grid-cols-[16rem,1fr]">
            <div className="max-h-80 overflow-y-auto border-b border-surface-muted/30 md:border-b-0 md:border-r">
              {filtered.map((template) => {
                const isActive = template.id === previewTemplate?.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setPreviewTemplateId(template.id)}
                    className={`w-full border-b border-surface-muted/20 px-4 py-3 text-left transition-colors last:border-b-0 ${
                      isActive ? 'bg-surface-base' : 'hover:bg-surface-base/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium text-ink">{template.name}</div>
                      {isActive ? <FiEye className="h-4 w-4 shrink-0 text-ink-secondary" /> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] text-ink-secondary">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </span>
                      {template.sectionKey && (
                        <span className="rounded-md bg-surface-base px-2 py-0.5 text-[11px] text-ink-secondary">
                          {SECTION_LABELS[template.sectionKey] || template.sectionKey}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {previewTemplate && (
              <div className="flex max-h-80 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">{previewTemplate.name}</div>
                    <p className="text-xs text-ink-muted">
                      Vista previa antes de insertar en la sección actual.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onInsert(previewTemplate.content);
                      setOpen(false);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-frame px-3 py-2 text-sm font-medium text-ink-onDark transition-colors hover:bg-frame-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frame/25"
                  >
                    <FiCheck className="h-4 w-4" />
                    Insertar
                  </button>
                </div>

                <div className="overflow-y-auto rounded-xl border border-surface-muted/35 bg-surface-base/45 p-3">
                  <pre className="whitespace-pre-wrap break-words font-sans text-sm text-ink-secondary">
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
