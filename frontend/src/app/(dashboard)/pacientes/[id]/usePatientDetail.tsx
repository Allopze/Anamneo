import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api, getErrorMessage, PaginatedResponse } from '@/lib/api';
import { DUPLICATE_ENCOUNTER_CREATED_MESSAGE } from '@/lib/encounter-duplicate';
import type { Patient, Encounter, PatientClinicalSummary } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { useHeaderBarSlot } from '@/components/layout/HeaderBarSlotContext';
import PatientContextBar from '@/components/PatientContextBar';
import type { InProgressEncounterSummary } from '@/components/common/InProgressEncounterConflictModal';
import { getPatientCompletenessMeta } from '@/lib/patient';
import { patientHistoryHasContent } from '@/lib/utils';
import {
  invalidateDashboardOverviewQueries,
  invalidateTaskOverviewQueries,
} from '@/lib/query-invalidation';
import toast from 'react-hot-toast';
import { problemSchema, taskSchema, type ProblemForm, type TaskForm, type VitalKey } from './patient-detail.constants';

export function usePatientDetail() {
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
  const [selectedVitalKey, setSelectedVitalKey] = useState<VitalKey>('peso');
  const [exportingPdf, setExportingPdf] = useState(false);

  const problemForm = useForm<ProblemForm>({
    resolver: zodResolver(problemSchema),
    defaultValues: { label: '', notes: '', status: 'ACTIVO' },
  });

  const taskForm = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: '', details: '', type: 'SEGUIMIENTO', recurrenceRule: 'NONE', dueDate: '' },
  });

  const canEditAdminFields = canEditPatientAdmin();
  const canCreateEncounterAllowed = canCreateEncounter();
  const isDoctor = isMedico();
  const isRedirectingAdmin = Boolean(user?.isAdmin);
  const adminRedirectPath = '/pacientes';

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
  const completenessMeta = patient ? getPatientCompletenessMeta(patient) : null;
  const vitalTrend = (showFullVitals && fullVitalsSummary ? fullVitalsSummary.vitalTrend : clinicalSummary?.vitalTrend) || [];

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
    if (!isRedirectingAdmin) return;
    router.replace(adminRedirectPath);
  }, [adminRedirectPath, isRedirectingAdmin, router]);

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
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createEncounterMutation = useMutation({
    mutationFn: (payload?: { duplicateFromEncounterId?: string }) => api.post(`/encounters/patient/${id}`, payload || {}),
    onSuccess: async (response, payload) => {
      const reused = Boolean((response.data as any)?.reused);
      const createdFromPreviousEncounter = Boolean(payload?.duplicateFromEncounterId);
      await invalidateDashboardOverviewQueries(queryClient);
      toast.success(
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
      toast.error(getErrorMessage(err));
    },
  });

  const verifyDemographicsMutation = useMutation({
    mutationFn: () => api.post(`/patients/${id}/verify-demographics`, {}),
    onSuccess: async () => {
      toast.success('Ficha verificada');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient-admin-summary', id] }),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

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
      api.post(`/patients/${id}/tasks`, { ...data, dueDate: data.dueDate || undefined }),
    onSuccess: async () => {
      toast.success('Seguimiento creado');
      taskForm.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, payload }: { taskId: string; payload: Partial<TaskForm> & Record<string, string | undefined> }) =>
      api.put(`/patients/tasks/${taskId}`, payload),
    onSuccess: async () => {
      toast.success('Seguimiento actualizado');
      setEditingTaskId(null);
      taskForm.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['patient', id] }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleExportHistorial = async () => {
    if (!patient || exportingPdf) return;
    setExportingPdf(true);
    try {
      const response = await api.get(`/patients/${id}/export/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (patient.nombre || 'Paciente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]+/g, ' ').trim();
      link.download = `${safeName} - Historial.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar el historial clínico');
    } finally {
      setExportingPdf(false);
    }
  };

  return {
    id,
    router,
    patient,
    isLoading,
    error,
    isAdmin: user?.isAdmin,
    isRedirectingAdmin,
    adminRedirectPath,
    isDoctor,
    canEditAdminFields,
    canCreateEncounterAllowed,
    canEditAntecedentes,
    historyHasContent,
    completenessMeta,

    // Encounter timeline
    encounterTimeline,
    isTimelineLoading,
    isTimelinePlaceholderData,
    encounterPage,
    setEncounterPage,

    // Clinical summary & vitals
    clinicalSummary,
    fullVitalsSummary,
    vitalTrend,
    selectedVitalKey,
    setSelectedVitalKey,
    showFullVitals,
    setShowFullVitals,

    // Forms
    problemForm,
    taskForm,

    // Dialog state
    showDeleteConfirm,
    setShowDeleteConfirm,
    conflictEncounters,
    setConflictEncounters,

    // Editing state
    editingProblemId,
    setEditingProblemId,
    editingTaskId,
    setEditingTaskId,

    // Mutation state
    exportingPdf,
    deleteMutation,
    createEncounterMutation,
    verifyDemographicsMutation,
    createProblemMutation,
    updateProblemMutation,
    createTaskMutation,
    updateTaskMutation,

    // Actions
    handleExportHistorial,
    handleDelete: () => setShowDeleteConfirm(true),
    confirmDelete: () => {
      setShowDeleteConfirm(false);
      deleteMutation.mutate();
    },
  };
}

export type PatientDetailHook = ReturnType<typeof usePatientDetail>;
