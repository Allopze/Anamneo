'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { type PatientSearchResult } from './agenda-types';

export function useAgendaPatientSearch(showForm: boolean) {
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);

  const normalizedSearch = patientSearch.trim();

  const { data: patientOptions = [], isFetching: isSearchingPatients } = useQuery({
    queryKey: ['agenda-patient-search', normalizedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '8');
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');
      params.set('search', normalizedSearch);
      const res = await api.get(`/patients?${params.toString()}`);
      return res.data.data as PatientSearchResult[];
    },
    enabled: showForm && normalizedSearch.length >= 2,
    staleTime: 30_000,
  });

  return { patientSearch, setPatientSearch, selectedPatient, setSelectedPatient, patientOptions, isSearchingPatients };
}
