'use client';

import Link from 'next/link';
import clsx from 'clsx';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiDownload,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiUser,
} from 'react-icons/fi';
import { parseHistoryField, patientHistoryHasContent } from '@/lib/utils';
import { formatDateOnly } from '@/lib/date';
import {
  formatPatientAge,
  formatPatientPrevision,
  formatPatientSex,
} from '@/lib/patient';
import ConfirmModal from '@/components/common/ConfirmModal';
import PatientAlerts from '@/components/PatientAlerts';
import PatientConsents from '@/components/PatientConsents';
import { InProgressEncounterConflictModal } from '@/components/common/InProgressEncounterConflictModal';

import { usePatientDetail } from './usePatientDetail';
import PatientProblemsCard from './PatientProblemsCard';
import PatientTasksCard from './PatientTasksCard';
import PatientVitalsCard from './PatientVitalsCard';
import PatientEncounterTimeline from './PatientEncounterTimeline';

export default function PatientDetailPage() {
  const pd = usePatientDetail();

  if (pd.isAdmin) return null;

  if (pd.isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 skeleton rounded-card" />
          <div>
            <div className="h-6 skeleton rounded w-48 mb-2" />
            <div className="h-4 skeleton rounded w-32" />
          </div>
        </div>
        <div className="card">
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 skeleton rounded w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (pd.error || !pd.patient) {
    return (
      <div className="text-center py-12">
        <FiAlertCircle className="w-12 h-12 text-status-red mx-auto mb-4" />
        <h2 className="text-xl font-bold text-ink mb-2">Paciente no encontrado</h2>
        <p className="text-ink-secondary mb-4">El paciente que buscas no existe o fue eliminado.</p>
        <Link href="/pacientes" className="btn btn-primary">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  const { patient, completenessMeta } = pd;

  return (
    <div className="animate-fade-in">
      {pd.conflictEncounters && (
        <InProgressEncounterConflictModal
          encounters={pd.conflictEncounters}
          patient={{ nombre: patient.nombre, rut: patient.rut }}
          onClose={() => pd.setConflictEncounters(null)}
          onOpenEncounter={(encounterId) => {
            pd.setConflictEncounters(null);
            pd.router.push(`/atenciones/${encounterId}`);
          }}
          allowCancel={pd.isDoctor}
          onCancelled={(encounterId) => {
            pd.setConflictEncounters((prev) => {
              if (!prev) return prev;
              const next = prev.filter((e) => e.id !== encounterId);
              return next.length > 0 ? next : null;
            });
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link href="/pacientes" className="p-2 hover:bg-surface-muted rounded-card transition-colors">
            <FiArrowLeft className="w-5 h-5 text-ink-secondary" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full border border-status-yellow/60 bg-status-yellow/35 flex items-center justify-center">
              <FiUser className="w-7 h-7 text-ink-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-ink">{patient.nombre}</h1>
              <p className="text-ink-secondary">
                {patient.rut || 'Sin RUT'} • {formatPatientAge(patient.edad, patient.edadMeses)} •{' '}
                {formatPatientSex(patient.sexo)}
              </p>
              {completenessMeta && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`list-chip ${completenessMeta.badgeClassName}`}>{completenessMeta.label}</span>
                  <span className="list-chip bg-surface-inset text-ink-secondary">{completenessMeta.registrationLabel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {(pd.isDoctor || pd.canEditAdminFields) && (
          <div className="flex items-center gap-3">
            {pd.canCreateEncounterAllowed && (
              <button
                onClick={() => pd.createEncounterMutation.mutate()}
                disabled={pd.createEncounterMutation.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                <FiPlus className="w-4 h-4" />
                Nueva Atención
              </button>
            )}
            {pd.canEditAdminFields && (
              <Link href={`/pacientes/${pd.id}/editar`} className="btn btn-secondary flex items-center gap-2">
                <FiEdit2 className="w-4 h-4" />
                Editar
              </Link>
            )}
            {patient.completenessStatus === 'VERIFICADA' && (
              <button
                onClick={pd.handleExportHistorial}
                disabled={pd.exportingPdf}
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiDownload className="w-4 h-4" />
                {pd.exportingPdf ? 'Exportando...' : 'Historial PDF'}
              </button>
            )}
            {pd.isDoctor && (
              <button
                onClick={pd.handleDelete}
                disabled={pd.deleteMutation.isPending}
                className="btn btn-danger flex items-center gap-2"
              >
                <FiTrash2 className="w-4 h-4" />
                Archivar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Completeness banner */}
      {completenessMeta && patient.completenessStatus && patient.completenessStatus !== 'VERIFICADA' && (
        <div className="mb-6 rounded-card border border-status-yellow/70 bg-status-yellow/40 p-4 text-sm text-accent-text">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium">{completenessMeta.label}</p>
              <p className="mt-1">{completenessMeta.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {pd.canEditAdminFields && (
                <Link href={`/pacientes/${pd.id}/editar`} className="btn btn-secondary text-sm">
                  Completar ficha
                </Link>
              )}
              {pd.isDoctor && patient.completenessStatus === 'PENDIENTE_VERIFICACION' && (
                <button
                  onClick={() => pd.verifyDemographicsMutation.mutate()}
                  disabled={pd.verifyDemographicsMutation.isPending}
                  className="btn btn-primary text-sm"
                >
                  {pd.verifyDemographicsMutation.isPending ? 'Verificando...' : 'Validar ficha'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Personal info */}
          <div className="card">
            <h2 className="text-lg font-bold text-ink mb-4">Información personal</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-ink-muted">RUT</dt>
                <dd className="font-medium">
                  {patient.rut || (
                    <span className="text-ink-muted">
                      Sin RUT {patient.rutExemptReason && `(${patient.rutExemptReason})`}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Edad</dt>
                <dd className="font-medium">{formatPatientAge(patient.edad, patient.edadMeses)}</dd>
              </div>
              {patient.fechaNacimiento && (
                <div>
                  <dt className="text-sm text-ink-muted">Fecha de nacimiento</dt>
                  <dd className="font-medium">{formatDateOnly(patient.fechaNacimiento)}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-ink-muted">Sexo</dt>
                <dd className="font-medium">{formatPatientSex(patient.sexo)}</dd>
              </div>
              <div>
                <dt className="text-sm text-ink-muted">Previsión</dt>
                <dd className="font-medium">{formatPatientPrevision(patient.prevision)}</dd>
              </div>
              {completenessMeta && (
                <div>
                  <dt className="text-sm text-ink-muted">Estado del registro</dt>
                  <dd className="font-medium">{completenessMeta.label}</dd>
                </div>
              )}
              {patient.trabajo && (
                <div>
                  <dt className="text-sm text-ink-muted">Trabajo</dt>
                  <dd className="font-medium">{patient.trabajo}</dd>
                </div>
              )}
              {patient.domicilio && (
                <div>
                  <dt className="text-sm text-ink-muted">Domicilio</dt>
                  <dd className="font-medium">{patient.domicilio}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Anamnesis summary */}
          {patient.history && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink">Antecedentes</h2>
                {pd.canEditAntecedentes() && (
                  <Link href={`/pacientes/${pd.id}/historial`} className="text-sm text-accent-text hover:text-ink">
                    Editar
                  </Link>
                )}
              </div>
              <div className="space-y-4 text-sm">
                {[
                  { key: 'antecedentesMedicos', label: 'Médicos' },
                  { key: 'antecedentesQuirurgicos', label: 'Quirúrgicos' },
                  { key: 'antecedentesGinecoobstetricos', label: 'Ginecoobstétricos' },
                  { key: 'antecedentesFamiliares', label: 'Familiares' },
                  { key: 'habitos', label: 'Hábitos' },
                  { key: 'medicamentos', label: 'Medicamentos' },
                  { key: 'alergias', label: 'Alergias', color: 'text-status-red' },
                  { key: 'inmunizaciones', label: 'Inmunizaciones' },
                  { key: 'antecedentesSociales', label: 'Sociales' },
                  { key: 'antecedentesPersonales', label: 'Personales' },
                ].map((field) => {
                  const rawVal = (patient.history as any)[field.key];
                  const val = parseHistoryField(rawVal);
                  const hasItems = val?.items?.length > 0;
                  const hasTexto = val?.texto && val.texto.trim().length > 0;
                  if (!hasItems && !hasTexto) return null;
                  return (
                    <div key={field.key} className="border-l-2 border-surface-muted/30 pl-3 py-1">
                      <dt className="text-ink-muted font-medium mb-1">{field.label}</dt>
                      <dd className={clsx('font-medium', field.color || 'text-ink-primary')}>
                        {hasItems && val.items.join(', ')}
                        {hasItems && hasTexto && <br />}
                        {hasTexto && val.texto}
                      </dd>
                    </div>
                  );
                })}
                {!pd.historyHasContent && <p className="text-ink-muted italic">No hay antecedentes registrados</p>}
              </div>
            </div>
          )}

          <PatientProblemsCard
            problems={patient.problems || []}
            editingProblemId={pd.editingProblemId}
            setEditingProblemId={pd.setEditingProblemId}
            problemForm={pd.problemForm}
            createProblemMutation={pd.createProblemMutation}
            updateProblemMutation={pd.updateProblemMutation}
          />

          <PatientTasksCard
            tasks={patient.tasks || []}
            editingTaskId={pd.editingTaskId}
            setEditingTaskId={pd.setEditingTaskId}
            taskForm={pd.taskForm}
            createTaskMutation={pd.createTaskMutation}
            updateTaskMutation={pd.updateTaskMutation}
          />

          <PatientVitalsCard
            clinicalSummary={pd.clinicalSummary}
            vitalTrend={pd.vitalTrend}
            showFullVitals={pd.showFullVitals}
            setShowFullVitals={pd.setShowFullVitals}
            selectedVitalKey={pd.selectedVitalKey}
            setSelectedVitalKey={pd.setSelectedVitalKey}
          />

          <div className="card">
            <PatientAlerts patientId={patient.id} />
          </div>

          <div className="card">
            <PatientConsents patientId={patient.id} />
          </div>
        </div>

        {/* Right column */}
        <PatientEncounterTimeline
          encounterTimeline={pd.encounterTimeline}
          encounterPage={pd.encounterPage}
          setEncounterPage={pd.setEncounterPage}
          isTimelineLoading={pd.isTimelineLoading}
          isTimelinePlaceholderData={pd.isTimelinePlaceholderData}
          canCreateEncounterAllowed={pd.canCreateEncounterAllowed}
          createEncounterMutation={pd.createEncounterMutation}
        />
      </div>

      <ConfirmModal
        isOpen={pd.showDeleteConfirm}
        onClose={() => pd.setShowDeleteConfirm(false)}
        onConfirm={pd.confirmDelete}
        title="Archivar paciente"
        message="¿Estás seguro de archivar este paciente? Sus atenciones en progreso se cancelarán y dejará de aparecer en las búsquedas habituales, pero podrá restaurarse más adelante."
        confirmLabel="Archivar paciente"
        variant="danger"
        loading={pd.deleteMutation.isPending}
      />
    </div>
  );
}
