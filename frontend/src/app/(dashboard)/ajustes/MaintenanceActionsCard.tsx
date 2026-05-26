'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { FiPlay, FiShield } from 'react-icons/fi';
import { api, getErrorMessage } from '@/lib/api';

const ACTIONS = [
  {
    key: 'purge-expired-password-reset-tokens',
    title: 'Purgar tokens reset expirados',
    confirmation: 'PURGAR TOKENS RESET EXPIRADOS',
  },
  {
    key: 'purge-deleted-attachments',
    title: 'Purgar adjuntos eliminados vencidos',
    confirmation: 'PURGAR ADJUNTOS ELIMINADOS VENCIDOS',
  },
  {
    key: 'rebuild-clinical-search',
    title: 'Reconstruir índice clínico',
    confirmation: 'RECONSTRUIR INDICE CLINICO',
  },
  {
    key: 'audit-legacy-plaintext',
    title: 'Auditar plaintext legacy',
    confirmation: 'AUDITAR PLAINTEXT LEGACY',
  },
] as const;

type MaintenanceActionKey = (typeof ACTIONS)[number]['key'];

export default function MaintenanceActionsCard() {
  const [forms, setForms] = useState<Record<string, { confirmation: string; reason: string }>>({});
  const [lastResult, setLastResult] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (action: MaintenanceActionKey) => {
      const form = forms[action] || { confirmation: '', reason: '' };
      const response = await api.post(`/admin/maintenance/${action}`, form);
      return response.data;
    },
    onSuccess: (data) => {
      setLastResult(JSON.stringify(data, null, 2));
      toast.success('Acción de mantenimiento ejecutada');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <section className="rounded-2xl border border-surface-muted/40 bg-surface-elevated p-4 text-sm text-ink-secondary">
      <div className="flex items-center gap-2">
        <FiShield className="h-4 w-4 text-accent" />
        <p className="font-medium text-ink-primary">Mantenimiento seguro</p>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Cada acción exige confirmación textual, motivo y queda registrada en auditoría.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {ACTIONS.map((action) => {
          const form = forms[action.key] || { confirmation: '', reason: '' };
          const canSubmit = form.confirmation === action.confirmation && form.reason.trim().length >= 10;
          return (
            <div key={action.key} className="rounded-xl border border-surface-muted/30 bg-white/70 px-4 py-3">
              <p className="font-medium text-ink-primary">{action.title}</p>
              <p className="mt-2 font-mono text-[11px] text-ink-muted">{action.confirmation}</p>
              <div className="mt-3 space-y-2">
                <input
                  value={form.confirmation}
                  onChange={(event) =>
                    setForms((current) => ({
                      ...current,
                      [action.key]: { ...form, confirmation: event.target.value },
                    }))
                  }
                  className="form-input font-mono text-xs"
                  placeholder="Confirmación exacta"
                />
                <input
                  value={form.reason}
                  onChange={(event) =>
                    setForms((current) => ({
                      ...current,
                      [action.key]: { ...form, reason: event.target.value },
                    }))
                  }
                  className="form-input"
                  placeholder="Motivo operativo"
                />
              </div>
              <button
                type="button"
                onClick={() => mutation.mutate(action.key)}
                disabled={!canSubmit || mutation.isPending}
                className="btn btn-secondary mt-3 flex items-center gap-2"
              >
                <FiPlay className="h-4 w-4" />
                Ejecutar
              </button>
            </div>
          );
        })}
      </div>

      {lastResult ? (
        <pre className="mt-4 max-h-64 overflow-auto rounded-xl bg-surface-inset p-3 text-xs text-ink-primary">
          {lastResult}
        </pre>
      ) : null}
    </section>
  );
}
