'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api, getErrorMessage, PaginatedResponse } from '@/lib/api';
import {
  Patient,
  Encounter,
  PatientClinicalSummary,
  PatientProblem,
  PatientTask,
  PROBLEM_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/types';
import { parseHistoryField, patientHistoryHasContent } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { buildEncounterSummary } from '@/lib/clinical';
import { InProgressEncounterConflictModal, InProgressEncounterSummary } from '@/components/common/InProgressEncounterConflictModal';
import MiniTrendChart from '@/components/common/MiniTrendChart';
import {
  FiArrowLeft,
  FiCheckCircle,
  FiClipboard,
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
  FiActivity,
} from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { extractDateOnly, formatDateOnly } from '@/lib/date';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import ConfirmModal from '@/components/common/ConfirmModal';
import PatientAlerts from '@/components/PatientAlerts';
import PatientConsents from '@/components/PatientConsents';
import PatientContextBar from '@/components/PatientContextBar';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';

const PROBLEM_STATUSES = ['ACTIVO', 'CRONICO', 'EN_ESTUDIO', 'RESUELTO'] as const;
const TASK_TYPES = ['SEGUIMIENTO', 'EXAMEN', 'DERIVACION', 'TRAMITE'] as const;

const problemSchema = z.object({
  label: z.string().min(2, 'Mínimo 2 caracteres').max(160, 'Máximo 160 caracteres'),
  notes: z.string().max(1000, 'Máximo 1000 caracteres').optional().or(z.literal('')),
  status: z.enum(PROBLEM_STATUSES),
});
type ProblemForm = z.infer<typeof problemSchema>;

const taskSchema = z.object({
  title: z.string().min(2, 'Mínimo 2 caracteres').max(160, 'Máximo 160 caracteres'),
  details: z.string().max(1200, 'Máximo 1200 caracteres').optional().or(z.literal('')),
  type: z.enum(TASK_TYPES),
  dueDate: z.string().optional().or(z.literal('')),
});
type TaskForm = z.infer<typeof taskSchema>;
import {
  formatPatientAge,
  formatPatientPrevision,
  formatPatientSex,
  getPatientCompletenessMeta,
} from '@/lib/patient';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isMedico, canEditAntecedentes, canEditPatientAdmin, canCreateEncounter } = useAuthStore();
  const [conflictEncounters, setConflictEncounters] = useState<InProgressEncounterSummary[] | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [encounterPage, setEncounterPage] = useState(1);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showFullVitals, setShowFullVitals] = useState(false);
  const [selectedVitalKey, setSelectedVitalKey] = useState<'peso' | 'imc' | 'temperatura' | 'saturacionOxigeno'>('peso');

  const problemForm = useForm<ProblemForm>({
    resolver: zodResolver(problemSchema),
    defaultValues: { label: '', notes: '', status: 'ACTIVO' },
  });

  const taskForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', details: '', type: 'SEGUIMIENTO', dueDate: '' },
  });

  const canEditAdminFields = canEditPatientAdmin();
  const canCreateEncounterAllowed = canCreateEncounter();

  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      return response.data as Patient;
    },
    enabled: !user?.isAdmin,
  });

  const {
    data: encounterTimeline,
    isLoading: isTimelineLoading,
    isPlaceholderData: isTimelinePlaceholderData,
  } = useQuery({
    queryKey: ['patient-encounters', id, encounterPage],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/encounters?page=${encounterPage}&limit=10`);
      return response.data as PaginatedResponse<Encounter>;
    },
    placeholderData: keepPreviousData,
    enabled: !user?.isAdmin,
  });

  const { data: clinicalSummary } = useQuery({
    queryKey: ['patient-clinical-summary', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/clinical-summary`);
      return response.data as PatientClinicalSummary;
    },
    enabled: !user?.isAdmin,
  });

  const { data: fullVitalsSummary } = useQuery({
    queryKey: ['patient-clinical-summary', id, 'full-vitals'],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/clinical-summary?vitalHistory=full`);
      return response.data as PatientClinicalSummary;
    },
    enabled: showFullVitals && !user?.isAdmin,
  });
  const historyHasContent = patientHistoryHasContent(patient?.history);
  const headerBarSlot = useHeaderBarSlot();

  useEffect(() => {
    if (!headerBarSlot || !patient) return;
    headerBarSlot.setHeaderBarSlot(
      <PatientContextBar
        nombre={patient.nombre}
        rut={patient.rut}
        edad={patient.edad}
        edadMeses={patient.edadMeses}
        sexo={patient.sexo}
        prevision={patient.prevision}
        completenessStatus={patient.completenessStatus}
      />,
    );
    return () => {
      headerBarSlot.setHeaderBarSlot(null);
    };
  }, [headerBarSlot, patient]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    router.replace('/pacientes');
  }, [router, user?.isAdmin]);

  useEffect(() => {
    setShowFullVitals(false);
    setSelectedVitalKey('peso');
    setEncounterPage(1);
    setEditingProblemId(null);
    setEditingTaskId(null);
  }, [id]);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/patients/${id}`),
    onSuccess: () => {
      toast.success('Paciente archivado');
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
      const response = (err as AxiosError<{ inProgressEncounters?: InProgressEncounterSummary[] }>).response;
      const status = response?.status;
      const data = response?.data;

      if (status === 409 && Array.isArray(data?.inProgressEncounters)) {
        setConflictEncounters(data.inProgressEncounters);
        return;
      }

      toast.error(getErrorMessage(err));
    },
  });

  const verifyDemographicsMutation = useMutation({
    mutationFn: () => api.post(`/patients/${id}/verify-demographics`, {}),
    onSuccess: () => {
      toast.success('Ficha verificada');
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['patient-admin-summary', id] });
    },
    onError: (err) => {
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

  const createProblemMutation = useMutation({
    mutationFn: async (data: ProblemForm) => api.post(`/patients/${id}/problems`, data),
    onSuccess: () => {
      toast.success('Problema agregado');
      problemForm.reset();
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateProblemMutation = useMutation({
    mutationFn: async ({ problemId, payload }: { problemId: string; payload: Partial<ProblemForm> }) =>
      api.put(`/patients/problems/${problemId}`, payload),
    onSuccess: () => {
      toast.success('Problema actualizado');
      setEditingProblemId(null);
      problemForm.reset();
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskForm) =>
      api.post(`/patients/${id}/tasks`, {
        ...data,
        dueDate: data.dueDate || undefined,
      }),
    onSuccess: () => {
      toast.success('Seguimiento creado');
      taskForm.reset();
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: string; payload: Partial<TaskForm> & Record<string, string | undefined> }) =>
      api.put(`/patients/tasks/${taskId}`, payload),
    onSuccess: () => {
      toast.success('Seguimiento actualizado');
      setEditingTaskId(null);
      taskForm.reset();
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (user?.isAdmin) {
    return null;
  }

  if (isLoading) {
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

  if (error || !patient) {
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

  const timelineEncounters = encounterTimeline?.data || [];
  const encounterPagination = encounterTimeline?.pagination;
  const vitalTrend = (showFullVitals && fullVitalsSummary ? fullVitalsSummary.vitalTrend : clinicalSummary?.vitalTrend) || [];
  const pendingTasks = (patient.tasks || []).filter((task) => task.status !== 'COMPLETADA' && task.status !== 'CANCELADA');
  const activeProblems = (patient.problems || []).filter((problem) => problem.status !== 'RESUELTO');
  const resolvedProblemsCount = (patient.problems || []).length - activeProblems.length;
  const completedTasksCount = (patient.tasks || []).length - pendingTasks.length;
  const completenessMeta = getPatientCompletenessMeta(patient);

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
          allowCancel={isMedico()}
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
                {patient.rut || 'Sin RUT'} • {formatPatientAge(patient.edad, patient.edadMeses)} • {formatPatientSex(patient.sexo)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`list-chip ${completenessMeta.badgeClassName}`}>{completenessMeta.label}</span>
                <span className="list-chip bg-surface-inset text-ink-secondary">{completenessMeta.registrationLabel}</span>
              </div>
            </div>
          </div>
        </div>
        {(isMedico() || canEditAdminFields) && (
          <div className="flex items-center gap-3">
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
                Archivar
              </button>
            )}
          </div>
        )}
      </div>

      {patient.completenessStatus && patient.completenessStatus !== 'VERIFICADA' && (
        <div className="mb-6 rounded-card border border-status-yellow/70 bg-status-yellow/40 p-4 text-sm text-accent-text">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-medium">{completenessMeta.label}</p>
              <p className="mt-1">{completenessMeta.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEditAdminFields && (
                <Link href={`/pacientes/${id}/editar`} className="btn btn-secondary text-sm">
                  Completar ficha
                </Link>
              )}
              {isMedico() && patient.completenessStatus === 'PENDIENTE_VERIFICACION' && (
                <button
                  onClick={() => verifyDemographicsMutation.mutate()}
                  disabled={verifyDemographicsMutation.isPending}
                  className="btn btn-primary text-sm"
                >
                  {verifyDemographicsMutation.isPending ? 'Verificando...' : 'Validar ficha'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Info */}
        <div className="lg:col-span-1 space-y-6">
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
              <div>
                <dt className="text-sm text-ink-muted">Estado del registro</dt>
                <dd className="font-medium">{completenessMeta.label}</dd>
              </div>
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

          {/* Remote anamnesis summary */}
          {patient.history && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-ink">Antecedentes</h2>
                {canEditAntecedentes() && (
                  <Link
                    href={`/pacientes/${id}/historial`}
                    className="text-sm text-accent-text hover:text-ink"
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
                {!historyHasContent && (
                  <p className="text-ink-muted italic">No hay antecedentes registrados</p>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink">Problemas activos</h2>
              <span className="text-xs text-ink-muted">
                {activeProblems.length} activos
                {resolvedProblemsCount > 0 ? ` · ${resolvedProblemsCount} resueltos ocultos` : ''}
              </span>
            </div>
            <div className="space-y-3">
              {activeProblems.length > 0 ? (
                activeProblems.map((problem: PatientProblem) => (
                  <div key={problem.id} className="rounded-card border border-surface-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink-primary">{problem.label}</p>
                        <p className="text-xs text-ink-muted">
                          {PROBLEM_STATUS_LABELS[problem.status]}
                          {problem.severity ? ` · ${problem.severity}` : ''}
                        </p>
                        {problem.notes && <p className="mt-1 text-sm text-ink-secondary">{problem.notes}</p>}
                      </div>
                      {problem.status !== 'RESUELTO' && (
                        <div className="flex items-center gap-2">
                          <button
                            className="text-xs text-ink-secondary hover:text-ink-primary"
                            onClick={() => {
                              setEditingProblemId(problem.id);
                              problemForm.reset({
                                label: problem.label,
                                notes: problem.notes || '',
                                status: problem.status,
                              });
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="text-xs text-accent-text hover:text-ink"
                            onClick={() => updateProblemMutation.mutate({ problemId: problem.id, payload: { status: 'RESUELTO' } })}
                          >
                            Resolver
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted">No hay problemas clínicos registrados.</p>
              )}
            </div>

            <form className="mt-4 space-y-2 border-t border-surface-muted/20 pt-4" onSubmit={problemForm.handleSubmit((data) => {
              if (editingProblemId) {
                updateProblemMutation.mutate({ problemId: editingProblemId, payload: data });
                return;
              }
              createProblemMutation.mutate(data);
            })}>
              <div>
                <input
                  className={clsx('form-input', problemForm.formState.errors.label && 'border-status-red')}
                  placeholder="Nuevo problema clínico"
                  {...problemForm.register('label')}
                />
                {problemForm.formState.errors.label && (
                  <p className="mt-1 text-xs text-status-red">{problemForm.formState.errors.label.message}</p>
                )}
              </div>
              <div>
                <textarea
                  className={clsx('form-input form-textarea', problemForm.formState.errors.notes && 'border-status-red')}
                  rows={2}
                  placeholder="Notas o contexto"
                  {...problemForm.register('notes')}
                />
                {problemForm.formState.errors.notes && (
                  <p className="mt-1 text-xs text-status-red">{problemForm.formState.errors.notes.message}</p>
                )}
              </div>
              <select
                className="form-input"
                {...problemForm.register('status')}
              >
                {Object.entries(PROBLEM_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="submit"
                className="btn btn-secondary w-full"
                disabled={createProblemMutation.isPending || updateProblemMutation.isPending}
              >
                {editingProblemId ? 'Actualizar problema' : 'Guardar problema'}
              </button>
              {editingProblemId && (
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => {
                    setEditingProblemId(null);
                    problemForm.reset();
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </form>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink">Seguimientos</h2>
              <span className="text-xs text-ink-muted">
                {pendingTasks.length} pendientes
                {completedTasksCount > 0 ? ` · ${completedTasksCount} cerrados ocultos` : ''}
              </span>
            </div>
            <div className="space-y-3">
              {pendingTasks.length > 0 ? (
                pendingTasks.map((task: PatientTask) => (
                  <div key={task.id} className="rounded-card border border-surface-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-ink-primary">{task.title}</p>
                        <p className="text-xs text-ink-muted">
                          {TASK_TYPE_LABELS[task.type]} · {TASK_STATUS_LABELS[task.status]}
                          {task.dueDate ? ` · ${formatDateOnly(task.dueDate)}` : ''}
                        </p>
                        {task.details && <p className="mt-1 text-sm text-ink-secondary">{task.details}</p>}
                      </div>
                      {task.status !== 'COMPLETADA' && (
                        <div className="flex items-center gap-2">
                          <button
                            className="text-xs text-ink-secondary hover:text-ink-primary"
                            onClick={() => {
                              setEditingTaskId(task.id);
                              taskForm.reset({
                                title: task.title,
                                details: task.details || '',
                                type: task.type,
                                dueDate: extractDateOnly(task.dueDate) || '',
                              });
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="text-xs text-accent-text hover:text-ink"
                            onClick={() => updateTaskMutation.mutate({ taskId: task.id, payload: { status: 'COMPLETADA' } })}
                          >
                            Completar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted">No hay seguimientos registrados.</p>
              )}
            </div>

            <form className="mt-4 space-y-2 border-t border-surface-muted/20 pt-4" onSubmit={taskForm.handleSubmit((data) => {
              if (editingTaskId) {
                updateTaskMutation.mutate({ taskId: editingTaskId, payload: data });
                return;
              }
              createTaskMutation.mutate(data);
            })}>
              <div>
                <input
                  className={clsx('form-input', taskForm.formState.errors.title && 'border-status-red')}
                  placeholder="Nuevo seguimiento o tarea"
                  {...taskForm.register('title')}
                />
                {taskForm.formState.errors.title && (
                  <p className="mt-1 text-xs text-status-red">{taskForm.formState.errors.title.message}</p>
                )}
              </div>
              <div>
                <textarea
                  className={clsx('form-input form-textarea', taskForm.formState.errors.details && 'border-status-red')}
                  rows={2}
                  placeholder="Detalle clínico u operativo"
                  {...taskForm.register('details')}
                />
                {taskForm.formState.errors.details && (
                  <p className="mt-1 text-xs text-status-red">{taskForm.formState.errors.details.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="form-input"
                  {...taskForm.register('type')}
                >
                  {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="form-input"
                  {...taskForm.register('dueDate')}
                />
              </div>
              <button
                type="submit"
                className="btn btn-secondary w-full"
                disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
              >
                {editingTaskId ? 'Actualizar seguimiento' : 'Guardar seguimiento'}
              </button>
              {editingTaskId && (
                <button
                  type="button"
                  className="btn btn-secondary w-full"
                  onClick={() => {
                    setEditingTaskId(null);
                    taskForm.reset();
                  }}
                >
                  Cancelar edición
                </button>
              )}
            </form>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FiActivity className="w-5 h-5 text-accent-text" />
                <h2 className="text-lg font-bold text-ink">Tendencias clínicas</h2>
              </div>
              {vitalTrend.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-accent-text hover:text-ink transition-colors"
                  onClick={() => setShowFullVitals((prev) => !prev)}
                >
                  {showFullVitals ? 'Ver resumen' : 'Ver historial completo'}
                </button>
              )}
            </div>
            {clinicalSummary?.recentDiagnoses?.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {clinicalSummary.recentDiagnoses.map((diagnosis) => (
                  <span key={diagnosis.label} className="rounded-full border border-status-yellow/60 bg-status-yellow/30 px-3 py-1 text-xs font-medium text-accent-text">
                    {diagnosis.label} · {diagnosis.count}
                  </span>
                ))}
              </div>
            ) : null}
            {vitalTrend.length > 0 ? (
              <div className="space-y-3">
                {showFullVitals && (
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { key: 'peso', label: 'Peso', unit: 'kg' },
                      { key: 'imc', label: 'IMC', unit: '' },
                      { key: 'temperatura', label: 'T°', unit: '°C' },
                      { key: 'saturacionOxigeno', label: 'SatO₂', unit: '%' },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selectedVitalKey === key
                            ? 'bg-accent-text text-surface-base'
                            : 'bg-surface-muted/40 text-ink-muted hover:text-ink'
                        }`}
                        onClick={() => setSelectedVitalKey(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {showFullVitals ? (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
                      {{ peso: 'Peso (kg)', imc: 'IMC', temperatura: 'Temperatura (°C)', saturacionOxigeno: 'Saturación O₂ (%)' }[selectedVitalKey]}
                      {' · '}{vitalTrend.filter((item) => item[selectedVitalKey] !== null).length} registros
                    </p>
                    <MiniTrendChart
                      values={vitalTrend.map((item) => item[selectedVitalKey]).filter((value): value is number => value !== null)}
                      height={80}
                      stroke={{ peso: '#0f766e', imc: '#7c3aed', temperatura: '#ea580c', saturacionOxigeno: '#2563eb' }[selectedVitalKey]}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">Peso</p>
                      <MiniTrendChart values={vitalTrend.map((item) => item.peso).filter((value): value is number => value !== null)} stroke="#0f766e" />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">IMC</p>
                      <MiniTrendChart values={vitalTrend.map((item) => item.imc).filter((value): value is number => value !== null)} stroke="#7c3aed" />
                    </div>
                  </div>
                )}
                {vitalTrend.slice(0, showFullVitals ? 12 : 5).map((item) => (
                  <div key={item.encounterId} className="rounded-card border border-surface-muted/30 p-3 text-sm">
                    <div className="font-medium text-ink-primary">
                      {format(new Date(item.createdAt), "d 'de' MMMM", { locale: es })}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-ink-secondary">
                      {item.presionArterial && <span>PA {item.presionArterial}</span>}
                      {item.peso !== null && <span>Peso {item.peso} kg</span>}
                      {item.imc !== null && <span>IMC {item.imc}</span>}
                      {item.temperatura !== null && <span>T° {item.temperatura}</span>}
                      {item.saturacionOxigeno !== null && <span>SatO2 {item.saturacionOxigeno}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
                <p className="text-sm text-ink-muted">Aún no hay signos vitales suficientes para mostrar tendencias.</p>
            )}
            {clinicalSummary?.latestEncounterSummary?.lines?.length ? (
              <div className="mt-4 rounded-card border border-surface-muted/30 bg-surface-base/40 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Último resumen longitudinal</p>
                <div className="space-y-1 text-sm text-ink-secondary">
                  {clinicalSummary.latestEncounterSummary.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <PatientAlerts patientId={patient.id} />
          </div>

          <div className="card">
            <PatientConsents patientId={patient.id} />
          </div>
        </div>

        {/* Encounters timeline */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ink">Atenciones</h2>
              <span className="text-sm text-ink-muted">
                {encounterPagination?.total || 0} atenciones registradas
              </span>
            </div>
            
            {timelineEncounters.length > 0 ? (
              <div className={clsx('relative transition-opacity duration-200', isTimelinePlaceholderData && 'opacity-50')}>
                <div className="absolute left-5 top-0 bottom-0 w-px bg-surface-muted" />

                <div className="space-y-4">
                  {timelineEncounters.map((encounter: Encounter) => {
                    const isCompleted = encounter.status === 'COMPLETADO';
                    const isInProgress = encounter.status === 'EN_PROGRESO';
                    const actionLabel = isInProgress ? 'Continuar' : 'Ver atención';

                    return (
                      <div key={encounter.id} className="relative pl-10">
                        <div
                          className={clsx(
                            'absolute left-1.5 top-4 w-7 h-7 rounded-full flex items-center justify-center border',
                            isCompleted
                              ? 'bg-status-green/20 text-status-green border-status-green/30'
                              : isInProgress
                              ? 'bg-status-yellow/40 text-accent-text border-status-yellow/70'
                              : 'bg-surface-muted text-ink-secondary border-surface-muted/30'
                          )}
                        >
                          <FiFileText className="w-4 h-4" />
                        </div>

                        <div className="rounded-card border border-surface-muted/30 bg-surface-elevated p-4 hover:bg-surface-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/atenciones/${encounter.id}`}
                                  className="font-medium text-ink-primary hover:text-accent-text"
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
                                      ? 'bg-status-green/20 text-status-green'
                                      : isInProgress
                                      ? 'border border-status-yellow/70 bg-status-yellow/40 text-accent-text'
                                      : 'bg-surface-muted text-ink-secondary'
                                  )}
                                >
                                  {STATUS_LABELS[encounter.status]}
                                </span>
                              </div>

                              <div className="mt-1 flex items-center gap-4 text-sm text-ink-muted flex-wrap">
                                <span className="flex items-center gap-1">
                                  <FiClock className="w-3 h-3" />
                                  {format(new Date(encounter.createdAt), 'HH:mm')}
                                </span>
                                <span>Por {encounter.createdBy?.nombre || '—'}</span>
                                {encounter.reviewStatus && (
                                  <span>{REVIEW_STATUS_LABELS[encounter.reviewStatus]}</span>
                                )}
                                {encounter.progress && (
                                  <span>
                                    {encounter.progress.completed}/{encounter.progress.total} secciones
                                  </span>
                                )}
                              </div>

                              {buildEncounterSummary(encounter).length > 0 && (
                                <div className="mt-3 space-y-1 rounded-card bg-surface-base/40 p-3 text-sm text-ink-secondary">
                                  {buildEncounterSummary(encounter).map((line) => (
                                    <p key={line}>{line}</p>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Link href={`/atenciones/${encounter.id}`} className="btn btn-secondary">
                                {actionLabel}
                                <FiChevronRight className="w-4 h-4 ml-1" />
                              </Link>
                            </div>
                          </div>

                          {encounter.tasks && encounter.tasks.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {encounter.tasks.slice(0, 3).map((task) => (
                                <span key={task.id} className="rounded-full border border-status-yellow/60 bg-status-yellow/30 px-2 py-1 text-accent-text">
                                  <FiClipboard className="mr-1 inline-block h-3 w-3" />
                                  {task.title}
                                </span>
                              ))}
                            </div>
                          )}

                          {isCompleted && (
                            <div className="mt-3 border-t border-surface-muted/20 pt-3">
                              <Link
                                href={`/atenciones/${encounter.id}/ficha`}
                                className="inline-flex items-center gap-2 text-sm font-medium text-accent-text hover:text-ink"
                              >
                                <FiEye className="w-4 h-4" />
                                Ver ficha clínica
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {encounterPagination && encounterPagination.totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between border-t border-surface-muted/20 pt-4">
                    <span className="text-sm text-ink-muted">
                      Página {encounterPagination.page} de {encounterPagination.totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        className="btn btn-secondary"
                        disabled={encounterPage <= 1}
                        onClick={() => setEncounterPage((current) => Math.max(current - 1, 1))}
                      >
                        Anterior
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={
                          isTimelinePlaceholderData
                          || encounterPage >= encounterPagination.totalPages
                        }
                        onClick={() => setEncounterPage((current) => current + 1)}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : isTimelineLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, index) => (
                  <div key={index} className="h-24 skeleton rounded-card" />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-16 h-16 bg-surface-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiCalendar className="w-8 h-8 text-ink-muted" />
                </div>
                <h3 className="font-medium text-ink-primary mb-1">Sin atenciones</h3>
                <p className="text-ink-muted mb-4">No hay atenciones registradas para este paciente</p>
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
        title="Archivar paciente"
        message="¿Estás seguro de archivar este paciente? Sus atenciones en progreso se cancelarán y dejará de aparecer en las búsquedas habituales, pero podrá restaurarse más adelante."
        confirmLabel="Archivar paciente"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
