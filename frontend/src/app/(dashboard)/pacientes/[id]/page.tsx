'use client';

import Link from 'next/link';
import { FiAlertCircle } from 'react-icons/fi';
import ConfirmModal from '@/components/common/ConfirmModal';
import { RouteAccessGate } from '@/components/common/RouteAccessGate';
import { usePatientDetail } from './usePatientDetail';
import PatientDetailHeader from './PatientDetailHeader';
import PatientDetailSidebar from './PatientDetailSidebar';
import PatientEncounterTimeline from './PatientEncounterTimeline';
import PatientOperationalHistoryCard from './PatientOperationalHistoryCard';

export default function PatientDetailPage() {
  const pd = usePatientDetail();

  if (pd.isRedirectingAdmin) {
    return (
      <RouteAccessGate
        when={true}
        title="Redirigiendo…"
        description="Esta vista clínica no está disponible para tu perfil. Te llevamos a la lista de pacientes."
        href={pd.adminRedirectPath}
        actionLabel="Ir a pacientes"
      />
    );
  }

  if (pd.isLoading) {
    return <PatientDetailSkeleton />;
  }

  if (pd.error || !pd.patient) {
    return <PatientNotFound />;
  }

  const { patient } = pd;

  return (
    <div className="animate-fade-in">
      <PatientDetailHeader patient={patient} pd={pd} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PatientDetailSidebar patient={patient} pd={pd} />
        <PatientEncounterTimeline
          encounterTimeline={pd.encounterTimeline}
          encounterPage={pd.encounterPage}
          setEncounterPage={pd.setEncounterPage}
          isTimelineLoading={pd.isTimelineLoading}
          isTimelinePlaceholderData={pd.isTimelinePlaceholderData}
          canCreateEncounterAllowed={pd.canCreateEncounterAllowed}
          createEncounterMutation={pd.createEncounterMutation}
        />

        <div className="lg:col-span-2">
          <PatientOperationalHistoryCard
            items={pd.patientOperationalHistory}
            isLoading={pd.isOperationalHistoryLoading}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(pd.mergeCandidate)}
        onClose={() => pd.setMergeCandidate(null)}
        onConfirm={pd.confirmMerge}
        title="Fusionar ficha duplicada"
        message={
          pd.mergeCandidate
            ? `Se moverán atenciones, seguimientos, problemas, consentimientos y alertas de ${pd.mergeCandidate.nombre} hacia esta ficha. La ficha origen quedará archivada.`
            : ''
        }
        confirmLabel="Fusionar en esta ficha"
        variant="warning"
        loading={pd.mergePatientMutation.isPending}
      />

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

function PatientDetailSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-4">
        <div className="skeleton h-10 w-10 rounded-card" />
        <div>
          <div className="skeleton mb-2 h-6 w-48 rounded" />
          <div className="skeleton h-4 w-32 rounded" />
        </div>
      </div>
      <div className="card">
        <div className="space-y-4">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="skeleton h-4 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PatientNotFound() {
  return (
    <div className="py-12 text-center">
      <FiAlertCircle className="mx-auto mb-4 h-12 w-12 text-status-red" />
      <h2 className="mb-2 text-xl font-bold text-ink">Paciente no encontrado</h2>
      <p className="mb-4 text-ink-secondary">El paciente que buscas no existe o fue eliminado.</p>
      <Link href="/pacientes" className="btn btn-primary">
        Volver a pacientes
      </Link>
    </div>
  );
}
