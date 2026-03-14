'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Patient, Encounter, SEXO_LABELS, PREVISION_LABELS, STATUS_LABELS } from '@/types';
import { parseHistoryField } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { InProgressEncounterConflictModal, InProgressEncounterSummary } from '@/components/common/InProgressEncounterConflictModal';
import {
  FiArrowLeft,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUser,
  FiCalendar,
  FiClock,
  FiFileText,
  FiEye,
  FiChevronRight,
  FiAlertCircle,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import ConfirmModal from '@/components/common/ConfirmModal';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isMedico, canEditAntecedentes, canEditPatientAdmin, canCreateEncounter } = useAuthStore();
  const [conflictEncounters, setConflictEncounters] = useState<InProgressEncounterSummary[] | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canEditAdminFields = canEditPatientAdmin();
  const canCreateEncounterAllowed = canCreateEncounter();

  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      return response.data as Patient;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/patients/${id}`),
    onSuccess: () => {
      toast.success('Paciente eliminado');
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      router.push('/pacientes');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const createEncounterMutation = useMutation({
    mutationFn: () => api.post(`/encounters/patient/${id}`, {}),
    onSuccess: (response) => {
      const reused = Boolean((response.data as any)?.reused);
      toast.success(reused ? 'Ya había una atención en curso. Abriendo…' : 'Atención creada');
      router.push(`/atenciones/${response.data.id}`);
    },
    onError: (err) => {
      const anyErr = err as any;
      const status = anyErr?.response?.status;
      const data = anyErr?.response?.data;

      if (status === 409 && Array.isArray(data?.inProgressEncounters)) {
        setConflictEncounters(data.inProgressEncounters as InProgressEncounterSummary[]);
        return;
      }

      toast.error(getErrorMessage(err));
    },
  });

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 skeleton rounded-lg" />
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

  if (error || !patient) {
    return (
      <div className="text-center py-12">
        <FiAlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Paciente no encontrado</h2>
        <p className="text-slate-600 mb-4">El paciente que buscas no existe o fue eliminado.</p>
        <Link href="/pacientes" className="btn btn-primary">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {conflictEncounters && (
        <InProgressEncounterConflictModal
          encounters={conflictEncounters}
          patient={{ nombre: patient.nombre, rut: patient.rut }}
          onClose={() => setConflictEncounters(null)}
          onOpenEncounter={(encounterId) => {
            setConflictEncounters(null);
            router.push(`/atenciones/${encounterId}`);
          }}
          onCancelled={(encounterId) => {
            setConflictEncounters((prev) => {
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
          <Link href="/pacientes" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <FiArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
              <FiUser className="w-7 h-7 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{patient.nombre}</h1>
              <p className="text-slate-600">
                {patient.rut || 'Sin RUT'} • {patient.edad} años • {SEXO_LABELS[patient.sexo]}
              </p>
            </div>
          </div>
        </div>
        {(isMedico() || canEditAdminFields) && (
          <div className="flex items-center gap-3">
            {canEditAntecedentes() && (
              <Link
                href={`/pacientes/${id}/historial`}
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiFileText className="w-4 h-4" />
                Historial
              </Link>
            )}
            {canCreateEncounterAllowed && (
              <button
                onClick={() => createEncounterMutation.mutate()}
                disabled={createEncounterMutation.isPending}
                className="btn btn-primary flex items-center gap-2"
              >
                <FiPlus className="w-4 h-4" />
                Nueva Atención
              </button>
            )}

            {canEditAdminFields && (
              <Link
                href={`/pacientes/${id}/editar`}
                className="btn btn-secondary flex items-center gap-2"
              >
                <FiEdit2 className="w-4 h-4" />
                Editar
              </Link>
            )}

            {isMedico() && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="btn btn-danger flex items-center gap-2"
              >
                <FiTrash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Información personal</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-slate-500">RUT</dt>
                <dd className="font-medium">
                  {patient.rut || (
                    <span className="text-slate-400">
                      Sin RUT {patient.rutExemptReason && `(${patient.rutExemptReason})`}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Edad</dt>
                <dd className="font-medium">{patient.edad} años</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Sexo</dt>
                <dd className="font-medium">{SEXO_LABELS[patient.sexo]}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Previsión</dt>
                <dd className="font-medium">{PREVISION_LABELS[patient.prevision]}</dd>
              </div>
              {patient.trabajo && (
                <div>
                  <dt className="text-sm text-slate-500">Trabajo</dt>
                  <dd className="font-medium">{patient.trabajo}</dd>
                </div>
              )}
              {patient.domicilio && (
                <div>
                  <dt className="text-sm text-slate-500">Domicilio</dt>
                  <dd className="font-medium">{patient.domicilio}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Remote anamnesis summary */}
          {patient.history && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Antecedentes</h2>
                {canEditAntecedentes() && (
                  <Link
                    href={`/pacientes/${id}/historial`}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
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
                  { key: 'alergias', label: 'Alergias', color: 'text-red-600' },
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
                    <div key={field.key} className="border-l-2 border-slate-100 pl-3 py-1">
                      <dt className="text-slate-500 font-medium mb-1">{field.label}</dt>
                      <dd className={clsx('font-medium', field.color || 'text-slate-800')}>
                        {hasItems && val.items.join(', ')}
                        {hasItems && hasTexto && <br />}
                        {hasTexto && val.texto}
                      </dd>
                    </div>
                  );
                })}
                {!Object.values(patient.history).some(v => v?.items?.length > 0 || v?.texto?.trim()?.length > 0) && (
                  <p className="text-slate-400 italic">No hay antecedentes registrados</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Encounters timeline */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Atenciones</h2>
              <span className="text-sm text-slate-500">
                {patient.encounters?.length || 0} atenciones registradas
              </span>
            </div>
            
            {patient.encounters && patient.encounters.length > 0 ? (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

                <div className="space-y-4">
                  {patient.encounters.map((encounter: Encounter) => {
                    const isCompleted = encounter.status === 'COMPLETADO';
                    const isInProgress = encounter.status === 'EN_PROGRESO';
                    const actionLabel = isInProgress ? 'Continuar' : 'Abrir';

                    return (
                      <div key={encounter.id} className="relative pl-10">
                        <div
                          className={clsx(
                            'absolute left-1.5 top-4 w-7 h-7 rounded-full flex items-center justify-center border',
                            isCompleted
                              ? 'bg-clinical-100 text-clinical-700 border-clinical-200'
                              : isInProgress
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          )}
                        >
                          <FiFileText className="w-4 h-4" />
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/atenciones/${encounter.id}`}
                                  className="font-medium text-slate-900 hover:text-primary-600"
                                >
                                  Atención del{' '}
                                  {format(new Date(encounter.createdAt), "d 'de' MMMM, yyyy", {
                                    locale: es,
                                  })}
                                </Link>
                                <span
                                  className={clsx(
                                    'text-xs px-2 py-0.5 rounded-full',
                                    isCompleted
                                      ? 'bg-clinical-100 text-clinical-700'
                                      : isInProgress
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-slate-100 text-slate-700'
                                  )}
                                >
                                  {STATUS_LABELS[encounter.status]}
                                </span>
                              </div>

                              <div className="mt-1 flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <FiClock className="w-3 h-3" />
                                  {format(new Date(encounter.createdAt), 'HH:mm')}
                                </span>
                                <span>Por {encounter.createdBy?.nombre || '—'}</span>
                                {encounter.progress && (
                                  <span>
                                    {encounter.progress.completed}/{encounter.progress.total} secciones
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Link href={`/atenciones/${encounter.id}`} className="btn btn-secondary">
                                {actionLabel}
                                <FiChevronRight className="w-4 h-4 ml-1" />
                              </Link>

                              {isCompleted && (
                                <Link
                                  href={`/atenciones/${encounter.id}/ficha`}
                                  className="btn btn-secondary flex items-center gap-2"
                                >
                                  <FiEye className="w-4 h-4" />
                                  Ficha
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCalendar className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="font-medium text-slate-900 mb-1">Sin atenciones</h3>
                <p className="text-slate-500 mb-4">No hay atenciones registradas para este paciente</p>
                {canCreateEncounterAllowed && (
                  <button
                    onClick={() => createEncounterMutation.mutate()}
                    className="btn btn-primary"
                  >
                    <FiPlus className="w-4 h-4 mr-2" />
                    Crear primera atención
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Eliminar paciente"
        message="¿Estás seguro de eliminar este paciente? Se eliminarán todos sus datos, atenciones y adjuntos. Esta acción no se puede deshacer."
        confirmLabel="Eliminar paciente"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
