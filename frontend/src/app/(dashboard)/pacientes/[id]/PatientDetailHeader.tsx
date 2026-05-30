'use client';

import Link from 'next/link';
import {
  FiArrowLeft,
  FiDownload,
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiUser,
} from 'react-icons/fi';
import { ClinicalAlertIcon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import {
  formatPatientAge,
  formatPatientSex,
} from '@/lib/patient';
import { api } from '@/lib/api';
import { InProgressEncounterConflictModal } from '@/components/common/InProgressEncounterConflictModal';
import PossiblePatientDuplicatesNotice from '@/components/common/PossiblePatientDuplicatesNotice';
import ReassignmentCard from '@/components/ReassignmentCard';
import PatientLongitudinalSummaryCard from './PatientLongitudinalSummaryCard';
import type { PatientDetailHook } from './usePatientDetail';

type PatientDetail = NonNullable<PatientDetailHook['patient']>;

interface Props {
  patient: PatientDetail;
  pd: PatientDetailHook;
}

type AllergyItem = { id: string; allergen: string; severity: string; deletedAt: string | null };

function useCriticalAllergies(patientId: string) {
  const { data: allergies = [] } = useQuery<AllergyItem[]>({
    queryKey: ['patient-allergies', patientId],
    queryFn: async () => {
      const res = await api.get<AllergyItem[]>(`/allergies/patient/${patientId}`);
      return res.data;
    },
    staleTime: 60_000,
  });
  return allergies.filter(
    (a) => !a.deletedAt && (a.severity === 'GRAVE' || a.severity === 'FATAL'),
  );
}

export default function PatientDetailHeader({ patient, pd }: Props) {
  const criticalAllergies = useCriticalAllergies(patient.id);

  return (
    <>
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

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pacientes" className="rounded-card p-2 transition-colors hover:bg-surface-muted" aria-label="Volver a pacientes">
            <FiArrowLeft className="h-5 w-5 text-ink-secondary" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-status-yellow/60 bg-status-yellow/35">
              <FiUser className="h-7 w-7 text-ink-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-ink">{patient.nombre}</h1>
              <p className="text-ink-secondary">
                {patient.rut || 'Sin RUT'} • {formatPatientAge(patient.edad, patient.edadMeses)} •{' '}
                {formatPatientSex(patient.sexo)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {pd.completenessMeta && (
                  <>
                    <span className={`list-chip ${pd.completenessMeta.badgeClassName}`}>{pd.completenessMeta.label}</span>
                    <span className="list-chip bg-surface-inset text-ink-secondary">{pd.completenessMeta.registrationLabel}</span>
                  </>
                )}
                {criticalAllergies.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-status-red/40 bg-status-red/15 px-2 py-0.5 font-semibold text-status-red"
                    title={criticalAllergies.map((a) => `${a.allergen} (${a.severity.toLowerCase()})`).join(', ')}
                  >
                    <ClinicalAlertIcon className="h-3 w-3" />
                    Alergia{criticalAllergies.length > 1 ? 's' : ''} {criticalAllergies.length > 1 ? `graves (${criticalAllergies.length})` : `grave: ${criticalAllergies[0].allergen}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {(pd.isDoctor || pd.canEditAdminFields) && (
          <div className="flex items-center gap-3">
            {pd.canCreateEncounterAllowed && (
              <button
                onClick={() => pd.createEncounterMutation.mutate({})}
                disabled={pd.createEncounterMutation.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                <FiPlus className="h-4 w-4" />
                Nueva Atención
              </button>
            )}
            {pd.canEditAdminFields && (
              <Link href={`/pacientes/${pd.id}/editar`} className="btn btn-secondary flex items-center gap-2">
                <FiEdit2 className="h-4 w-4" />
                Editar
              </Link>
            )}
            {patient.completenessStatus === 'VERIFICADA' && (
              <>
                <button
                  onClick={pd.handleExportHistorial}
                  disabled={pd.exportingPdf}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <FiDownload className="h-4 w-4" />
                  {pd.exportingPdf ? 'Exportando...' : 'Historial PDF'}
                </button>
                <button
                  onClick={pd.handleExportBundle}
                  disabled={pd.exportingBundle}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <FiDownload className="h-4 w-4" />
                  {pd.exportingBundle ? 'Armando paquete...' : 'Paquete clínico'}
                </button>
              </>
            )}
            {pd.isDoctor && (
              <button
                onClick={pd.handleDelete}
                disabled={pd.deleteMutation.isPending}
                className="btn btn-danger flex items-center gap-2"
              >
                <FiTrash2 className="h-4 w-4" />
                Archivar
              </button>
            )}
          </div>
        )}
      </div>

      {pd.completenessMeta && patient.completenessStatus && patient.completenessStatus !== 'VERIFICADA' && (
        <div className="mb-6 rounded-card border border-status-yellow/70 bg-status-yellow/40 p-4 text-sm text-accent-text">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium">{pd.completenessMeta.label}</p>
              <p className="mt-1">{pd.completenessMeta.description}</p>
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

      <PossiblePatientDuplicatesNotice
        className="mb-6"
        nombre={patient.nombre}
        fechaNacimiento={patient.fechaNacimiento}
        rut={patient.rut}
        rutExempt={patient.rutExempt}
        excludePatientId={patient.id}
        duplicateAction={pd.isDoctor ? {
          label: 'Consolidar en esta ficha',
          pendingLabel: 'Fusionando...',
          pendingDuplicateId: pd.mergePatientMutation.isPending ? pd.mergeCandidate?.id ?? null : null,
          onClick: (duplicate) => pd.setMergeCandidate(duplicate),
        } : undefined}
        resolutionAction={pd.isDoctor ? {
          label: 'Archivar esta ficha duplicada',
          helperText: 'Úsalo solo después de revisar la otra ficha y confirmar cuál debe quedar vigente.',
          onClick: pd.handleDelete,
        } : undefined}
      />

      <PatientLongitudinalSummaryCard patient={patient} clinicalSummary={pd.clinicalSummary} />

      {pd.canReassignPatientAllowed && (
        <div className="mb-6">
          <ReassignmentCard
            title="Reasignar paciente"
            description="Mueve la ficha, problemas y seguimientos al médico destino."
            endpoint={`/patients/${pd.id}/reassign`}
            includeOpenEncountersOption
            onSuccess={pd.handleReassignmentSuccess}
          />
        </div>
      )}
    </>
  );
}
