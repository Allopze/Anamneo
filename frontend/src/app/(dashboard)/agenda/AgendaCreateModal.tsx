'use client';

import { FiX } from 'react-icons/fi';
import type { AppointmentForm, PatientSearchResult } from './agenda-types';

interface CreateAppointmentModalProps {
  form: AppointmentForm;
  setForm: (form: AppointmentForm) => void;
  selectedPatient: PatientSearchResult | null;
  setSelectedPatient: (patient: PatientSearchResult | null) => void;
  patientSearch: string;
  setPatientSearch: (value: string) => void;
  normalizedPatientSearch: string;
  patientOptions: PatientSearchResult[];
  isSearchingPatients: boolean;
  isCreating: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function CreateAppointmentModal({
  form,
  setForm,
  selectedPatient,
  setSelectedPatient,
  patientSearch,
  setPatientSearch,
  normalizedPatientSearch,
  patientOptions,
  isSearchingPatients,
  isCreating,
  onClose,
  onSubmit,
}: CreateAppointmentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card border border-surface-muted/40 bg-surface-elevated p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">Nueva cita</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface-muted/30">
            <FiX className="h-4 w-4 text-ink-muted" />
          </button>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-3">
          <PatientPicker
            selectedPatient={selectedPatient}
            setSelectedPatient={setSelectedPatient}
            patientSearch={patientSearch}
            setPatientSearch={setPatientSearch}
            normalizedPatientSearch={normalizedPatientSearch}
            patientOptions={patientOptions}
            isSearchingPatients={isSearchingPatients}
          />
          <DateTimeFields form={form} setForm={setForm} />
          <div>
            <label className="form-label text-xs">Título / motivo (opcional)</label>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="form-input mt-0.5"
              placeholder="Ej: Consulta de control, Procedimiento..."
              maxLength={200}
            />
          </div>
          <div>
            <label className="form-label text-xs">Notas (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className="form-input mt-0.5 resize-none"
              rows={2}
              placeholder="Observaciones adicionales"
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary text-sm">
              Cancelar
            </button>
            <button type="submit" disabled={isCreating} className="btn btn-primary text-sm">
              {isCreating ? 'Creando...' : 'Crear cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DateTimeFields({ form, setForm }: Pick<CreateAppointmentModalProps, 'form' | 'setForm'>) {
  return (
    <>
      <div>
        <label className="form-label text-xs">Fecha</label>
        <input
          type="date"
          value={form.startDate}
          onChange={(event) => setForm({ ...form, startDate: event.target.value })}
          className="form-input mt-0.5"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="form-label text-xs">Hora inicio</label>
          <input
            type="time"
            value={form.startTime}
            onChange={(event) => setForm({ ...form, startTime: event.target.value })}
            className="form-input mt-0.5"
            required
          />
        </div>
        <div>
          <label className="form-label text-xs">Hora fin</label>
          <input
            type="time"
            value={form.endTime}
            onChange={(event) => setForm({ ...form, endTime: event.target.value })}
            className="form-input mt-0.5"
            required
          />
        </div>
      </div>
    </>
  );
}

interface PatientPickerProps {
  selectedPatient: PatientSearchResult | null;
  setSelectedPatient: (patient: PatientSearchResult | null) => void;
  patientSearch: string;
  setPatientSearch: (value: string) => void;
  normalizedPatientSearch: string;
  patientOptions: PatientSearchResult[];
  isSearchingPatients: boolean;
}

function PatientPicker({
  selectedPatient,
  setSelectedPatient,
  patientSearch,
  setPatientSearch,
  normalizedPatientSearch,
  patientOptions,
  isSearchingPatients,
}: PatientPickerProps) {
  return (
    <div>
      <label className="form-label text-xs">Paciente (opcional)</label>
      <input
        value={selectedPatient ? selectedPatient.nombre : patientSearch}
        onChange={(event) => {
          setSelectedPatient(null);
          setPatientSearch(event.target.value);
        }}
        className="form-input mt-0.5"
        placeholder="Buscar por nombre o RUT"
      />
      {selectedPatient ? (
        <p className="mt-1 text-xs text-ink-muted">
          Vinculado a {selectedPatient.nombre}
          {selectedPatient.rut ? ` · ${selectedPatient.rut}` : ''}
        </p>
      ) : null}
      {!selectedPatient && normalizedPatientSearch.length >= 2 ? (
        <PatientOptions
          patientOptions={patientOptions}
          isSearchingPatients={isSearchingPatients}
          onSelect={(patient) => {
            setSelectedPatient(patient);
            setPatientSearch(patient.nombre);
          }}
        />
      ) : null}
    </div>
  );
}

function PatientOptions({
  patientOptions,
  isSearchingPatients,
  onSelect,
}: {
  patientOptions: PatientSearchResult[];
  isSearchingPatients: boolean;
  onSelect: (patient: PatientSearchResult) => void;
}) {
  return (
    <div className="mt-1 max-h-36 overflow-y-auto rounded-input border border-surface-muted/30 bg-surface-base text-sm">
      {isSearchingPatients ? (
        <p className="px-3 py-2 text-xs text-ink-muted">Buscando pacientes...</p>
      ) : patientOptions.length === 0 ? (
        <p className="px-3 py-2 text-xs text-ink-muted">Sin coincidencias</p>
      ) : patientOptions.map((patient) => (
        <button
          key={patient.id}
          type="button"
          onClick={() => onSelect(patient)}
          className="block w-full px-3 py-2 text-left hover:bg-surface-muted/30"
        >
          <span className="block font-medium text-ink">{patient.nombre}</span>
          <span className="text-xs text-ink-muted">
            {patient.rut || (patient.rutExempt ? `Sin RUT: ${patient.rutExemptReason || 'exento'}` : 'RUT pendiente')}
          </span>
        </button>
      ))}
    </div>
  );
}
