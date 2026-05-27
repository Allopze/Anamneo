'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PatientClinicalSummary } from '@/types';
import type { VitalKey } from './patient-detail.constants';

interface UsePatientVitalsParams {
  id: string;
  isAdmin: boolean;
}

export function usePatientVitals({ id, isAdmin }: UsePatientVitalsParams) {
  const [showFullVitals, setShowFullVitals] = useState(false);
  const [selectedVitalKey, setSelectedVitalKey] = useState<VitalKey>('peso');

  useEffect(() => {
    setShowFullVitals(false);
    setSelectedVitalKey('peso');
  }, [id]);

  const clinicalSummaryQuery = useQuery({
    queryKey: ['patient-clinical-summary', id],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/clinical-summary`);
      return response.data as PatientClinicalSummary;
    },
    enabled: !isAdmin,
  });

  const fullVitalsSummaryQuery = useQuery({
    queryKey: ['patient-clinical-summary', id, 'full-vitals'],
    queryFn: async () => {
      const response = await api.get(`/patients/${id}/clinical-summary?vitalHistory=full`);
      return response.data as PatientClinicalSummary;
    },
    enabled: showFullVitals && !isAdmin,
  });

  const clinicalSummary = clinicalSummaryQuery.data;
  const fullVitalsSummary = fullVitalsSummaryQuery.data;
  const vitalTrend =
    (showFullVitals && fullVitalsSummary ? fullVitalsSummary.vitalTrend : clinicalSummary?.vitalTrend) || [];

  return {
    clinicalSummary,
    fullVitalsSummary,
    vitalTrend,
    showFullVitals,
    setShowFullVitals,
    selectedVitalKey,
    setSelectedVitalKey,
  };
}
