'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FiFileText, FiChevronDown } from 'react-icons/fi';

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

export default function TemplateSelector({ sectionKey, onInsert }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);

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
        <div className="absolute z-20 left-0 top-full mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onInsert(t.content); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
            >
              <div className="text-sm font-medium text-slate-900 truncate">{t.name}</div>
              <div className="text-xs text-slate-500">{CATEGORY_LABELS[t.category] || t.category}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
