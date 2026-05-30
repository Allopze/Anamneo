'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';
import { FiPlus, FiTrash2, FiEdit2, FiX, FiCheck } from 'react-icons/fi';
import { ClinicalAlertIcon } from '@/components/icons';
import { useAuthIsMedico } from '@/stores/auth-store';

const SEVERITY_CONFIG = {
  LEVE:     { label: 'Leve',     className: 'bg-status-yellow/20 text-accent-text border-status-yellow/40' },
  MODERADA: { label: 'Moderada', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30' },
  GRAVE:    { label: 'Grave',    className: 'bg-status-red/15 text-status-red border-status-red/30' },
  FATAL:    { label: 'Fatal',    className: 'bg-status-red/30 text-status-red border-status-red/60 font-semibold' },
} as const;

type Severity = keyof typeof SEVERITY_CONFIG;

interface Allergy {
  id: string;
  allergen: string;
  severity: Severity;
  reactionType: string | null;
  onsetDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface FormState {
  allergen: string;
  severity: Severity;
  reactionType: string;
  notes: string;
}

const DEFAULT_FORM: FormState = { allergen: '', severity: 'MODERADA', reactionType: '', notes: '' };

interface Props {
  patientId: string;
}

export default function PatientAllergiesList({ patientId }: Props) {
  const queryClient = useQueryClient();
  const isMedico = useAuthIsMedico();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const { data: allergies = [], isLoading } = useQuery({
    queryKey: ['patient-allergies', patientId],
    queryFn: async () => {
      const res = await api.get<Allergy[]>(`/allergies/patient/${patientId}`);
      return res.data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['patient-allergies', patientId] });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/allergies', {
        patientId,
        allergen: form.allergen.trim(),
        severity: form.severity,
        reactionType: form.reactionType.trim() || undefined,
        notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => {
      notify.success('Alergia registrada');
      setShowForm(false);
      setForm(DEFAULT_FORM);
      void invalidate();
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/allergies/${id}`, {
        allergen: form.allergen.trim(),
        severity: form.severity,
        reactionType: form.reactionType.trim() || undefined,
        notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => {
      notify.success('Alergia actualizada');
      setEditingId(null);
      void invalidate();
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/allergies/${id}`),
    onSuccess: () => {
      notify.success('Alergia eliminada');
      void invalidate();
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const startEdit = (a: Allergy) => {
    setEditingId(a.id);
    setForm({
      allergen: a.allergen,
      severity: a.severity,
      reactionType: a.reactionType ?? '',
      notes: a.notes ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const hasAllergies = allergies.length > 0;

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasAllergies && (
            <ClinicalAlertIcon className="h-4 w-4 text-status-red" />
          )}
          <h2 className="text-lg font-bold text-ink">
            Alergias
            {hasAllergies ? (
              <span className="ml-2 rounded-full bg-status-red/15 px-2 py-0.5 text-xs font-semibold text-status-red">
                {allergies.length}
              </span>
            ) : null}
          </h2>
        </div>
        {isMedico && !showForm && (
          <button
            type="button"
            onClick={() => { setShowForm(true); setEditingId(null); }}
            className="btn btn-secondary text-xs"
          >
            <FiPlus className="mr-1 h-3.5 w-3.5" />
            Agregar
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
          className="mb-4 space-y-2 rounded-card border border-surface-muted/30 bg-surface-base/40 p-3 text-sm"
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label text-xs">Alérgeno *</label>
              <input
                value={form.allergen}
                onChange={(e) => setForm({ ...form, allergen: e.target.value })}
                className="form-input mt-0.5 text-xs"
                placeholder="Ej: Penicilina, Mariscos, Látex"
                required
              />
            </div>
            <div>
              <label className="form-label text-xs">Severidad</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
                className="form-input mt-0.5 text-xs"
              >
                {Object.entries(SEVERITY_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="form-label text-xs">Tipo de reacción</label>
            <input
              value={form.reactionType}
              onChange={(e) => setForm({ ...form, reactionType: e.target.value })}
              className="form-input mt-0.5 text-xs"
              placeholder="Ej: Urticaria, Anafilaxia, Edema"
            />
          </div>
          <div>
            <label className="form-label text-xs">Notas adicionales</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="form-input mt-0.5 text-xs"
              placeholder="Observaciones clínicas relevantes"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); }} className="btn btn-secondary text-xs">
              Cancelar
            </button>
            <button type="submit" disabled={createMutation.isPending} className="btn btn-danger text-xs">
              {createMutation.isPending ? 'Guardando…' : 'Registrar alergia'}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-xs text-ink-muted">Cargando alergias…</p>
      ) : allergies.length === 0 ? (
        <p className="rounded-card border border-dashed border-surface-muted/50 bg-surface-base/30 p-3 text-xs text-ink-muted">
          Sin alergias registradas.
        </p>
      ) : (
        <ul className="space-y-2">
          {allergies.map((a) =>
            editingId === a.id ? (
              <li key={a.id} className="rounded-card border border-accent/30 bg-surface-base/40 p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="form-label text-xs">Alérgeno</label>
                    <input value={form.allergen} onChange={(e) => setForm({ ...form, allergen: e.target.value })} className="form-input mt-0.5 text-xs" />
                  </div>
                  <div>
                    <label className="form-label text-xs">Severidad</label>
                    <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })} className="form-input mt-0.5 text-xs">
                      {Object.entries(SEVERITY_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="form-label text-xs">Tipo de reacción</label>
                  <input value={form.reactionType} onChange={(e) => setForm({ ...form, reactionType: e.target.value })} className="form-input mt-0.5 text-xs" />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={cancelEdit} className="btn btn-secondary text-xs"><FiX className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => updateMutation.mutate(a.id)} disabled={updateMutation.isPending} className="btn btn-primary text-xs">
                    <FiCheck className="h-3.5 w-3.5 mr-1" />Guardar
                  </button>
                </div>
              </li>
            ) : (
              <li key={a.id} className={`flex items-start justify-between gap-3 rounded-card border px-3 py-2 ${SEVERITY_CONFIG[a.severity]?.className ?? ''}`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{a.allergen}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs opacity-80">
                    <span>{SEVERITY_CONFIG[a.severity]?.label ?? a.severity}</span>
                    {a.reactionType && <span>· {a.reactionType}</span>}
                    {a.notes && <span>· {a.notes}</span>}
                  </div>
                </div>
                {isMedico && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => startEdit(a)} className="rounded p-1 text-xs opacity-60 hover:opacity-100" aria-label="Editar alergia">
                      <FiEdit2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeMutation.mutate(a.id)} disabled={removeMutation.isPending} className="rounded p-1 text-xs opacity-60 hover:text-status-red hover:opacity-100" aria-label="Eliminar alergia">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}
