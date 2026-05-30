'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useAuthIsMedico } from '@/stores/auth-store';
import { MedicationCreateForm, MedicationEditRow } from './PatientMedicationsList.parts';

const STATUS_CONFIG = {
  ACTIVO:     { label: 'Activo',     className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/30' },
  SUSPENDIDO: { label: 'Suspendido', className: 'bg-surface-muted/40 text-ink-muted border-surface-muted/50' },
} as const;

type MedicationStatus = keyof typeof STATUS_CONFIG;

interface Medication {
  id: string;
  drug: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  status: MedicationStatus;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
}

interface FormState {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  status: MedicationStatus;
  notes: string;
}

const DEFAULT_FORM: FormState = {
  drug: '',
  dose: '',
  route: '',
  frequency: '',
  status: 'ACTIVO',
  notes: '',
};

interface Props {
  patientId: string;
}

export default function PatientMedicationsList({ patientId }: Props) {
  const queryClient = useQueryClient();
  const isMedico = useAuthIsMedico();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const { data: medications = [], isLoading } = useQuery({
    queryKey: ['patient-medications', patientId],
    queryFn: async () => (await api.get<Medication[]>(`/patient-medications/patient/${patientId}`)).data,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['patient-medications', patientId] });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/patient-medications', {
        patientId,
        drug: form.drug.trim(),
        dose: form.dose.trim() || undefined,
        route: form.route.trim() || undefined,
        frequency: form.frequency.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      notify.success('Medicamento registrado');
      setShowForm(false);
      setForm(DEFAULT_FORM);
      void invalidate();
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      api.put(`/patient-medications/${id}`, {
        drug: form.drug.trim(),
        dose: form.dose.trim() || undefined,
        route: form.route.trim() || undefined,
        frequency: form.frequency.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }),
    onSuccess: () => {
      notify.success('Medicamento actualizado');
      setEditingId(null);
      void invalidate();
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/patient-medications/${id}`),
    onSuccess: () => {
      notify.success('Medicamento eliminado');
      void invalidate();
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });

  const startEdit = (m: Medication) => {
    setEditingId(m.id);
    setForm({ drug: m.drug, dose: m.dose ?? '', route: m.route ?? '', frequency: m.frequency ?? '', status: m.status, notes: m.notes ?? '' });
  };

  const hasMedications = medications.length > 0;
  const activeCount = medications.filter((m) => m.status === 'ACTIVO').length;

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-ink">
            Medicamentos
            {hasMedications ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                {activeCount} activo{activeCount !== 1 ? 's' : ''}
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
        <MedicationCreateForm
          form={form}
          isPending={createMutation.isPending}
          statusConfig={STATUS_CONFIG}
          setForm={setForm}
          onCancel={() => { setShowForm(false); setForm(DEFAULT_FORM); }}
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}
        />
      )}

      {isLoading ? (
        <p className="text-xs text-ink-muted">Cargando medicamentos…</p>
      ) : medications.length === 0 ? (
        <p className="rounded-card border border-dashed border-surface-muted/50 bg-surface-base/30 p-3 text-xs text-ink-muted">
          Sin medicamentos registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {medications.map((m) =>
            editingId === m.id ? (
              <MedicationEditRow
                key={m.id}
                medicationId={m.id}
                form={form}
                isPending={updateMutation.isPending}
                statusConfig={STATUS_CONFIG}
                setForm={setForm}
                onCancel={() => { setEditingId(null); setForm(DEFAULT_FORM); }}
                onSave={(id) => updateMutation.mutate(id)}
              />
            ) : (
              <li
                key={m.id}
                className={`flex items-start justify-between gap-3 rounded-card border px-3 py-2 ${
                  STATUS_CONFIG[m.status]?.className ?? ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{m.drug}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs opacity-80">
                    <span>{STATUS_CONFIG[m.status]?.label ?? m.status}</span>
                    {m.dose && <span>· {m.dose}</span>}
                    {m.route && <span>· {m.route}</span>}
                    {m.frequency && <span>· {m.frequency}</span>}
                    {m.notes && <span>· {m.notes}</span>}
                  </div>
                </div>
                {isMedico && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(m)}
                      className="rounded p-1 text-xs opacity-60 hover:opacity-100"
                      aria-label="Editar medicamento"
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(m.id)}
                      disabled={removeMutation.isPending}
                      className="rounded p-1 text-xs opacity-60 hover:text-status-red hover:opacity-100"
                      aria-label="Eliminar medicamento"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
