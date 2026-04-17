import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '@/lib/api';
import { invalidateDashboardOverviewQueries } from '@/lib/query-invalidation';
import { useAuthStore } from '@/stores/auth-store';
import type { Encounter } from '@/types';

export function useDuplicateEncounterAction(encounter: Pick<Encounter, 'id' | 'patientId' | 'status'> | undefined) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreateEncounter } = useAuthStore();
  const patientId = encounter?.patientId;
  const canDuplicateEncounter = Boolean(
    encounter?.id && patientId && encounter.status !== 'EN_PROGRESO' && canCreateEncounter(),
  );

  const duplicateEncounterMutation = useMutation({
    mutationFn: async () => {
      if (!encounter?.id) {
        throw new Error('Atención no disponible para duplicar');
      }

      const response = await api.post(`/encounters/${encounter.id}/duplicate`);
      return response.data as { id: string; reused?: boolean };
    },
    onSuccess: async (response) => {
      await Promise.all([
        invalidateDashboardOverviewQueries(queryClient),
        patientId ? queryClient.invalidateQueries({ queryKey: ['patient-encounters', patientId] }) : Promise.resolve(),
        patientId ? queryClient.invalidateQueries({ queryKey: ['patient-clinical-summary', patientId] }) : Promise.resolve(),
      ]);

      toast.success(response.reused ? 'Ya había una atención en curso. Abriendo…' : 'Borrador duplicado');
      router.push(`/atenciones/${response.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleDuplicateEncounter = () => {
    if (!canDuplicateEncounter || duplicateEncounterMutation.isPending) {
      return;
    }

    duplicateEncounterMutation.mutate();
  };

  return {
    canDuplicateEncounter,
    duplicateEncounterMutation,
    handleDuplicateEncounter,
  };
}