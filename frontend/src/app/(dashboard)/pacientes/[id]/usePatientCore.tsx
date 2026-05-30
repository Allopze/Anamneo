'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api, getErrorMessage, type PaginatedResponse } from '@/lib/api';
import { DUPLICATE_ENCOUNTER_CREATED_MESSAGE } from '@/lib/encounter-duplicate';
import { getPatientCompletenessMeta } from '@/lib/patient';
import { patientHistoryHasContent } from '@/lib/utils';
import type { Encounter, Patient, PatientOperationalHistoryItem } from '@/types';
import { canReassignPatient } from '@/lib/permissions';
import {
  useAuthCanCreateEncounter,
  useAuthCanEditAntecedentes,
  useAuthCanEditPatientAdmin,
  useAuthIsMedico,
  useAuthUser,
} from '@/stores/auth-store';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';
import PatientContextBar from '@/components/PatientContextBar';
import type { InProgressEncounterSummary } from '@/components/common/InProgressEncounterConflictModal';
import {
  invalidateDashboardOverviewQueries,
  invalidateOperationalQueries,
  invalidateTaskOverviewQueries,
} from '@/lib/query-invalidation';
import { notify } from '@/lib/notify';
import { problemSchema, taskSchema, type ProblemForm, type TaskForm } from './patient-detail.constants';
import { normalizeTaskUpdatePayload, type TaskUpdatePayload } from './patient-detail.helpers';
import type { PossiblePatientDuplicate } from '@/components/common/PossiblePatientDuplicatesNotice';
export function usePatientCore() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthUser();
  const isDoctor = useAuthIsMedico();
  const canEditAntecedentes = useAuthCanEditAntecedentes();
  const canEditAdminFields = useAuthCanEditPatientAdmin();
  const canCreateEncounterAllowed = useAuthCanCreateEncounter();
  const canReassignPatientAllowed = canReassignPatient(user);
  const isAdmin = Boolean(user?.isAdmin);
  const [conflictEncounters, setConflictEncounters] = useState<InProgressEncounterSummary[] | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [encounterPage, setEncounterPage] = useState(1);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [mergeCandidate, setMergeCandidate] = useState<PossiblePatientDuplicate | null>(null);
  const patientQuery = useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}`);
      return response.data as Patient;
    },
    enabled: !isAdmin,
  });
  const encounterTimelineQuery = useQuery({
    queryKey: ['patient-encounters', id, encounterPage],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/encounters?page=${encounterPage}&limit=10`);
      return response.data as PaginatedResponse<Encounter>;
    },
    placeholderData: keepPreviousData,
    enabled: !isAdmin,
  });
  const operationalHistoryQuery = useQuery({
    queryKey: ['patient-operational-history', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/operational-history?limit=12`);
      return response.data as PatientOperationalHistoryItem[];
    },
    enabled: !isAdmin,
  });
  const patient = patientQuery.data;
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
    setEncounterPage(1);
    setEditingProblemId(null);
    setEditingTaskId(null);
  }, [id]);
  const problemForm = useForm<ProblemForm>({
    resolver: zodResolver(problemSchema),
    defaultValues: { label: '', notes: '', status: 'ACTIVO' },
  });
  const taskForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      details: '',
      type: 'SEGUIMIENTO',
      priority: 'MEDIA',
      recurrenceRule: 'NONE',
      dueDate: '',
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/patients/${id}`),
    onSuccess: (response) => {
      const autoCancelledEncounterCount = Number(
        (response.data as { autoCancelledEncounterCount?: number })?.autoCancelledEncounterCount ?? 0,
      );
      notify.success(
        autoCancelledEncounterCount > 0
          ? `Paciente archivado. Se cancelaron ${autoCancelledEncounterCount} atenciones en progreso.`
          : 'Paciente archivado',
      );
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      router.push('/pacientes');
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });
  const createEncounterMutation = useMutation({
    mutationFn: (payload?: { duplicateFromEncounterId?: string }) =>
      api.post(`/encounters/patient/${id}`, payload || {}),
    onSuccess: async (response, payload) => {
      const reused = Boolean((response.data as any)?.reused);
      const createdFromPreviousEncounter = Boolean(payload?.duplicateFromEncounterId);
      await invalidateDashboardOverviewQueries(queryClient);
      notify.success(
        reused
          ? 'Ya había una atención en curso. Abriendo…'
          : createdFromPreviousEncounter
            ? DUPLICATE_ENCOUNTER_CREATED_MESSAGE
            : 'Atención creada',
      );
      router.push(`/atenciones/${response.data.id}`);
    },
    onError: (err) => {
      const response = (err as AxiosError<{ inProgressEncounters?: InProgressEncounterSummary[] }>).response;
      if (response?.status === 409 && Array.isArray(response.data?.inProgressEncounters)) {
        setConflictEncounters(response.data.inProgressEncounters);
        return;
      }
      notify.error(getErrorMessage(err));
    },
  });
  const verifyDemographicsMutation = useMutation({
    mutationFn: () => api.post(`/patients/${id}/verify-demographics`, {}),
    onSuccess: async () => {
      notify.success('Ficha verificada');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-admin-summary', id] }),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });
  const mergePatientMutation = useMutation({
    mutationFn: async (sourcePatientId: string) => api.post(`/patients/${id}/merge`, { sourcePatientId }),
    onSuccess: async (response) => {
      const counts = (response.data as { counts?: { encountersMoved?: number } })?.counts;
      setMergeCandidate(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-encounters', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-operational-history', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-clinical-summary', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-admin-summary', id] }),
        queryClient.invalidateQueries({ queryKey: ['patients'] }),
        invalidateOperationalQueries(queryClient),
      ]);
      notify.success(
        counts?.encountersMoved && counts.encountersMoved > 0
          ? `Ficha fusionada. Se movieron ${counts.encountersMoved} atenciones a este paciente.`
          : 'Ficha fusionada correctamente',
      );
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });
  const createProblemMutation = useMutation({
    mutationFn: async (data: ProblemForm) => api.post(`/patients/${id}/problems`, data),
    onSuccess: () => {
      notify.success('Problema agregado');
      problemForm.reset();
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });
  const updateProblemMutation = useMutation({
    mutationFn: async ({ problemId, payload }: { problemId: string; payload: Partial<ProblemForm> }) =>
      api.put(`/patients/problems/${problemId}`, payload),
    onSuccess: () => {
      notify.success('Problema actualizado');
      setEditingProblemId(null);
      problemForm.reset();
      queryClient.invalidateQueries({ queryKey: ['patient', id] });
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });
  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskForm) =>
      api.post(`/patients/${id}/tasks`, { ...data, dueDate: data.dueDate || undefined }),
    onSuccess: async () => {
      notify.success('Seguimiento creado');
      taskForm.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });
  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: string; payload: TaskUpdatePayload }) =>
      api.put(`/patients/tasks/${taskId}`, normalizeTaskUpdatePayload(payload)),
    onSuccess: async () => {
      notify.success('Seguimiento actualizado');
      setEditingTaskId(null);
      taskForm.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => notify.error(getErrorMessage(err)),
  });
  return {
    id,
    router,
    patient,
    isLoading: patientQuery.isLoading,
    error: patientQuery.error,
    isAdmin,
    isRedirectingAdmin: isAdmin,
    adminRedirectPath: '/pacientes' as const,
    isDoctor,
    canEditAdminFields,
    canCreateEncounterAllowed,
    canReassignPatientAllowed,
    canEditAntecedentes,
    historyHasContent: patientHistoryHasContent(patient?.history),
    completenessMeta: patient ? getPatientCompletenessMeta(patient) : null,
    encounterTimeline: encounterTimelineQuery.data,
    isTimelineLoading: encounterTimelineQuery.isLoading,
    isTimelinePlaceholderData: encounterTimelineQuery.isPlaceholderData,
    patientOperationalHistory: operationalHistoryQuery.data,
    isOperationalHistoryLoading: operationalHistoryQuery.isLoading,
    encounterPage,
    setEncounterPage,
    problemForm,
    taskForm,
    showDeleteConfirm,
    setShowDeleteConfirm,
    conflictEncounters,
    setConflictEncounters,
    mergeCandidate,
    setMergeCandidate,
    editingProblemId,
    setEditingProblemId,
    editingTaskId,
    setEditingTaskId,
    deleteMutation,
    createEncounterMutation,
    verifyDemographicsMutation,
    mergePatientMutation,
    createProblemMutation,
    updateProblemMutation,
    createTaskMutation,
    updateTaskMutation,
    handleReassignmentSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-encounters', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-operational-history', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-clinical-summary', id] }),
      ]);
    },
    handleDelete: () => setShowDeleteConfirm(true),
    confirmMerge: () => {
      if (!mergeCandidate) return;
      mergePatientMutation.mutate(mergeCandidate.id);
    },
    confirmDelete: () => {
      setShowDeleteConfirm(false);
      deleteMutation.mutate();
    },
  };
}
