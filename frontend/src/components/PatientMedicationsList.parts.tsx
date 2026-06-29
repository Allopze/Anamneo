'use client';

import type { Dispatch, SetStateAction } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';

const STATUS_CONFIG = {
  ACTIVO:     { label: 'Activo',     className: '' },
  SUSPENDIDO: { label: 'Suspendido', className: '' },
} as const;

type MedicationStatus = keyof typeof STATUS_CONFIG;

interface FormState {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  status: MedicationStatus;
  notes: string;
}

interface MedicationCreateFormProps {
  form: FormState;
  isPending: boolean;
  statusConfig: Record<MedicationStatus, { label: string }>;
  setForm: Dispatch<SetStateAction<FormState>>;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function MedicationCreateForm({
  form,
  isPending,
  statusConfig,
  setForm,
  onCancel,
  onSubmit,
}: MedicationCreateFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-4 space-y-2 rounded-card border border-surface-muted/30 bg-surface-base/40 p-3 text-sm"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="form-label text-xs">Medicamento *</label>
          <input
            value={form.drug}
            onChange={(e) => setForm({ ...form, drug: e.target.value })}
            className="form-input mt-0.5 text-xs"
            placeholder="Ej: Metformina, Atorvastatina, Ibuprofeno"
            required
          />
        </div>
        <div>
          <label className="form-label text-xs">Dosis</label>
          <input
            value={form.dose}
            onChange={(e) => setForm({ ...form, dose: e.target.value })}
            className="form-input mt-0.5 text-xs"
            placeholder="Ej: 500 mg, 10 mg/ml"
          />
        </div>
        <div>
          <label className="form-label text-xs">Estado</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as MedicationStatus })}
            className="form-input mt-0.5 text-xs"
          >
            {Object.entries(statusConfig).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="form-label text-xs">Vía</label>
          <input
            value={form.route}
            onChange={(e) => setForm({ ...form, route: e.target.value })}
            className="form-input mt-0.5 text-xs"
            placeholder="Ej: Oral, IV, IM"
          />
        </div>
        <div>
          <label className="form-label text-xs">Frecuencia</label>
          <input
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="form-input mt-0.5 text-xs"
            placeholder="Ej: Cada 12 horas, 1 vez/día"
          />
        </div>
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
        <button type="button" onClick={onCancel} className="btn btn-secondary text-xs">
          Cancelar
        </button>
        <button type="submit" disabled={isPending} className="btn btn-primary text-xs">
          {isPending ? 'Guardando…' : 'Registrar medicamento'}
        </button>
      </div>
    </form>
  );
}

interface MedicationEditRowProps {
  medicationId: string;
  form: FormState;
  isPending: boolean;
  statusConfig: Record<MedicationStatus, { label: string }>;
  setForm: Dispatch<SetStateAction<FormState>>;
  onCancel: () => void;
  onSave: (id: string) => void;
}

export function MedicationEditRow({
  medicationId,
  form,
  isPending,
  statusConfig,
  setForm,
  onCancel,
  onSave,
}: MedicationEditRowProps) {
  return (
    <li className="rounded-card border border-accent/30 bg-surface-base/40 p-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="form-label text-xs">Medicamento</label>
          <input
            value={form.drug}
            onChange={(e) => setForm({ ...form, drug: e.target.value })}
            className="form-input mt-0.5 text-xs"
          />
        </div>
        <div>
          <label className="form-label text-xs">Dosis</label>
          <input
            value={form.dose}
            onChange={(e) => setForm({ ...form, dose: e.target.value })}
            className="form-input mt-0.5 text-xs"
          />
        </div>
        <div>
          <label className="form-label text-xs">Estado</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as MedicationStatus })}
            className="form-input mt-0.5 text-xs"
          >
            {Object.entries(statusConfig).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label text-xs">Vía</label>
          <input
            value={form.route}
            onChange={(e) => setForm({ ...form, route: e.target.value })}
            className="form-input mt-0.5 text-xs"
          />
        </div>
        <div>
          <label className="form-label text-xs">Frecuencia</label>
          <input
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="form-input mt-0.5 text-xs"
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary text-xs">
          <FiX className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onSave(medicationId)}
          disabled={isPending}
          className="btn btn-primary text-xs"
        >
          <FiCheck className="h-3.5 w-3.5 mr-1" />Guardar
        </button>
      </div>
    </li>
  );
}
