'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiSave } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';
import type { EncounterSectionConfig } from '../../../../../shared/encounter-section-config';

export default function EncounterSectionsSettingsCard() {
  const [config, setConfig] = useState<EncounterSectionConfig | null>(null);

  const query = useQuery({
    queryKey: ['settings', 'encounter-sections'],
    queryFn: async () => (await api.get('/settings/encounter-sections')).data as EncounterSectionConfig,
  });

  useEffect(() => {
    if (query.data) {
      setConfig(query.data);
    }
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: async () => api.put('/settings/encounter-sections', { config }),
    onSuccess: async (response) => {
      setConfig(response.data as EncounterSectionConfig);
      await query.refetch();
      toast.success('Secciones de atención actualizadas');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading || !config) {
    return (
      <section className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4">
        <div className="h-20 skeleton rounded-xl" />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-ink-primary">Secciones de atención</p>
          <p className="mt-1 text-xs text-ink-muted">Orden, visibilidad y requisito de cierre del wizard clínico.</p>
        </div>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="btn btn-primary flex items-center gap-2"
        >
          <FiSave className="h-4 w-4" />
          {mutation.isPending ? 'Guardando...' : 'Guardar secciones'}
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {config.sections.map((section, index) => (
          <div
            key={section.key}
            className="grid gap-3 rounded-xl border border-surface-muted/30 bg-white/70 px-3 py-3 md:grid-cols-[84px_minmax(0,1fr)_auto_auto]"
          >
            <div>
              <label className="form-label" htmlFor={`${section.key}-order`}>Orden</label>
              <input
                id={`${section.key}-order`}
                type="number"
                value={section.order}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setConfig((current) => current && {
                    sections: current.sections.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, order: Number.isFinite(value) ? value : item.order } : item,
                    ),
                  });
                }}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label" htmlFor={`${section.key}-label`}>Nombre visible</label>
              <input
                id={`${section.key}-label`}
                value={section.label}
                onChange={(event) => {
                  setConfig((current) => current && {
                    sections: current.sections.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, label: event.target.value } : item,
                    ),
                  });
                }}
                className="form-input"
              />
              <p className="mt-1 font-mono text-[11px] text-ink-muted">{section.key}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-secondary md:self-end md:pb-3">
              <input
                type="checkbox"
                checked={section.enabled}
                onChange={(event) => {
                  setConfig((current) => current && {
                    sections: current.sections.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, enabled: event.target.checked } : item,
                    ),
                  });
                }}
                className="h-4 w-4 rounded border-surface-muted"
              />
              Habilitada
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-secondary md:self-end md:pb-3">
              <input
                type="checkbox"
                checked={section.requiredForCompletion}
                onChange={(event) => {
                  setConfig((current) => current && {
                    sections: current.sections.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, requiredForCompletion: event.target.checked } : item,
                    ),
                  });
                }}
                className="h-4 w-4 rounded border-surface-muted"
              />
              Requerida
            </label>
          </div>
        ))}
      </div>
    </section>
  );
}
