import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, PaginatedResponse } from '@/lib/api';
import { getPatientCompletenessMeta } from '@/lib/patient';
import { patientHistoryHasContent } from '@/lib/utils';
import type {
  Encounter,
  Patient,
  PatientClinicalSummary,
  PatientOperationalHistoryItem,
} from '@/types';

interface UsePatientDetailQueriesParams {
  encounterPage: number;
  id: string;
  isAdmin: boolean;
  showFullVitals: boolean;
}

export function usePatientDetailQueries({
  encounterPage,
  id,
  isAdmin,
  showFullVitals,
}: UsePatientDetailQueriesParams) {
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

  const patient = patientQuery.data;
  const clinicalSummary = clinicalSummaryQuery.data;
  const fullVitalsSummary = fullVitalsSummaryQuery.data;

  return {
    patient,
    isLoading: patientQuery.isLoading,
    error: patientQuery.error,
    encounterTimeline: encounterTimelineQuery.data,
    isTimelineLoading: encounterTimelineQuery.isLoading,
    isTimelinePlaceholderData: encounterTimelineQuery.isPlaceholderData,
    patientOperationalHistory: operationalHistoryQuery.data,
    isOperationalHistoryLoading: operationalHistoryQuery.isLoading,
    clinicalSummary,
    fullVitalsSummary,
    historyHasContent: patientHistoryHasContent(patient?.history),
    completenessMeta: patient ? getPatientCompletenessMeta(patient) : null,
    vitalTrend: (showFullVitals && fullVitalsSummary ? fullVitalsSummary.vitalTrend : clinicalSummary?.vitalTrend) || [],
  };
}
