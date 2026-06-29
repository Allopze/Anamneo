import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Encounter } from '@/types';

interface UseEncounterWizardEncounterParams {
  id: string;
  isOperationalAdmin: boolean;
}

export function useEncounterWizardEncounter({ id, isOperationalAdmin }: UseEncounterWizardEncounterParams) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const {
    data: encounter,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['encounter', id, 'editor'],
    queryFn: async () => {
      const response = await api.get(
        `/encounters/${id}?includeSignatureBaseline=false&includeAttachments=false&includeConsents=false&includeTasks=false&includeSignatures=false&includeSuggestions=false`,
      );
      return response.data as Encounter;
    },
    enabled: !isOperationalAdmin,
  });

  useEffect(() => {
    if (!encounter?.createdAt) {
      setElapsedMinutes(0);
      return;
    }

    const calculateElapsedMinutes = () =>
      Math.max(0, Math.floor((Date.now() - new Date(encounter.createdAt).getTime()) / 60000));

    setElapsedMinutes(calculateElapsedMinutes());
    const interval = setInterval(() => setElapsedMinutes(calculateElapsedMinutes()), 60000);
    return () => clearInterval(interval);
  }, [encounter?.createdAt]);

  return {
    encounter,
    isLoading,
    error,
    elapsedMinutes,
  };
}
