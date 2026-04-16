import { useCallback, useEffect, useState } from 'react';
import type { AxiosResponse } from 'axios';
import { useMutation, type QueryClient, type UseMutationResult } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { normalizeClosureNoteForCompletion } from '@/lib/encounter-completion';
import { clearEncounterDraft } from '@/lib/encounter-draft';
import { getEncounterClinicalOutputBlockReason } from '@/lib/clinical-output';
import { invalidateDashboardOverviewQueries, invalidateTaskOverviewQueries } from '@/lib/query-invalidation';
import type { Encounter, SignEncounterResponse } from '@/types';
import toast from 'react-hot-toast';
import type { CompleteEncounterPayload } from './encounter-wizard.constants';

interface UseEncounterWorkflowActionsParams {
  canEdit: boolean;
  encounter?: Encounter;
  ensureActiveSectionSaved: () => Promise<boolean>;
  id: string;
  navigate: (href: string) => void;
  queryClient: QueryClient;
  userId?: string;
}

export function useEncounterWorkflowActions(params: UseEncounterWorkflowActionsParams) {
  const { canEdit, encounter, ensureActiveSectionSaved, id, navigate, queryClient, userId } = params;
  const [quickTask, setQuickTask] = useState({ title: '', type: 'SEGUIMIENTO', dueDate: '' });
  const [reviewActionNote, setReviewActionNote] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  useEffect(() => {
    setReviewActionNote(encounter?.reviewNote || '');
    setClosureNote(encounter?.closureNote || '');
  }, [encounter?.id, encounter?.reviewNote, encounter?.closureNote]);

  const completeMutation = useMutation<void, unknown, CompleteEncounterPayload>({
    mutationFn: async (payload) => {
      await api.post(`/encounters/${id}/complete`, payload);
    },
    onSuccess: async () => {
      if (userId) clearEncounterDraft(id, userId);
      toast.success('Atención completada');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['encounter', id] }),
        invalidateDashboardOverviewQueries(queryClient),
        invalidateTaskOverviewQueries(queryClient),
      ]);
      navigate(`/atenciones/${id}/ficha`);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const signMutation = useMutation<SignEncounterResponse, unknown, string>({
    mutationFn: async (password) => {
      const response: AxiosResponse<SignEncounterResponse> = await api.post(`/encounters/${id}/sign`, { password });
      return response.data;
    },
    onSuccess: () => {
      setShowSignModal(false);
      toast.success('Atención firmada electrónicamente');
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reviewStatusMutation = useMutation({
    mutationFn: async ({
      reviewStatus,
      note,
    }: {
      reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO';
      note?: string;
    }) => api.put(`/encounters/${id}/review-status`, { reviewStatus, note }),
    onSuccess: async () => {
      toast.success('Estado de revisión actualizado');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['encounter', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient', encounter?.patientId] }),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const createTaskMutation = useMutation({
    mutationFn: async () =>
      api.post(`/patients/${encounter?.patientId}/tasks`, {
        ...quickTask,
        encounterId: id,
        dueDate: quickTask.dueDate || undefined,
      }),
    onSuccess: async () => {
      toast.success('Seguimiento creado');
      setQuickTask({ title: '', type: 'SEGUIMIENTO', dueDate: '' });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['encounter', id] }),
        queryClient.invalidateQueries({ queryKey: ['patient', encounter?.patientId] }),
        invalidateTaskOverviewQueries(queryClient),
        invalidateDashboardOverviewQueries(queryClient),
      ]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const handleComplete = useCallback(async () => {
    if (!canEdit) return;

    const blockReason = getEncounterClinicalOutputBlockReason(encounter?.clinicalOutputBlock, 'COMPLETE_ENCOUNTER');
    if (blockReason) {
      toast.error(blockReason);
      return;
    }

    const saved = await ensureActiveSectionSaved();
    if (!saved) return;

    setShowCompleteConfirm(true);
  }, [canEdit, encounter?.clinicalOutputBlock, ensureActiveSectionSaved]);

  const confirmComplete = useCallback(() => {
    setShowCompleteConfirm(false);
    completeMutation.mutate({ closureNote: normalizeClosureNoteForCompletion(closureNote) });
  }, [closureNote, completeMutation]);

  const handleReviewStatusChange = useCallback(
    (reviewStatus: 'NO_REQUIERE_REVISION' | 'LISTA_PARA_REVISION' | 'REVISADA_POR_MEDICO') => {
      reviewStatusMutation.mutate({ reviewStatus, note: reviewActionNote });
    },
    [reviewActionNote, reviewStatusMutation],
  );

  const handleViewFicha = useCallback(async () => {
    const saved = await ensureActiveSectionSaved();
    if (!saved) return;
    navigate(`/atenciones/${id}/ficha`);
  }, [ensureActiveSectionSaved, id, navigate]);

  return {
    quickTask,
    setQuickTask,
    reviewActionNote,
    setReviewActionNote,
    closureNote,
    setClosureNote,
    showCompleteConfirm,
    setShowCompleteConfirm,
    showSignModal,
    setShowSignModal,
    completeMutation,
    signMutation,
    reviewStatusMutation,
    createTaskMutation,
    handleComplete,
    confirmComplete,
    handleReviewStatusChange,
    handleViewFicha,
  };
}