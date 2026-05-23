import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthUser } from '@/stores/auth-store';
import {
  ONBOARDING_VERSION,
  isOnboardingRole,
  type OnboardingRole,
  type OnboardingStep,
} from '../../../shared/onboarding-contract';

export interface OnboardingProgressResponse {
  version: typeof ONBOARDING_VERSION;
  eligible: boolean;
  role: OnboardingRole | null;
  steps: OnboardingStep[];
  completedStepIds: string[];
  dismissedAt: string | null;
  completedAt: string | null;
  isComplete: boolean;
}

interface UpdateOnboardingProgressInput {
  completedStepIds?: string[];
  dismissed?: boolean;
  completed?: boolean;
}

export const ONBOARDING_QUERY_KEY = ['onboarding', ONBOARDING_VERSION, 'me'] as const;

export function useOnboarding() {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const eligible = isOnboardingRole(user?.role);

  const query = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: async () => {
      const response = await api.get('/onboarding/me');
      return response.data as OnboardingProgressResponse;
    },
    enabled: eligible,
    staleTime: 5 * 60_000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateOnboardingProgressInput) => {
      const response = await api.patch('/onboarding/me', payload);
      return response.data as OnboardingProgressResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ONBOARDING_QUERY_KEY, data);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/onboarding/me/reset');
      return response.data as OnboardingProgressResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ONBOARDING_QUERY_KEY, data);
    },
  });

  return {
    eligible,
    progress: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateProgress: updateMutation.mutate,
    updateProgressAsync: updateMutation.mutateAsync,
    resetOnboarding: resetMutation.mutate,
    resetOnboardingAsync: resetMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    isResetting: resetMutation.isPending,
  };
}
