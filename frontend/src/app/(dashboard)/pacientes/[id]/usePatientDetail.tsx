'use client';

import { usePatientCore } from './usePatientCore';
import { usePatientVitals } from './usePatientVitals';
import { usePatientDocuments } from './usePatientDocuments';

export function usePatientDetail() {
  const core = usePatientCore();
  const vitals = usePatientVitals({ id: core.id, isAdmin: core.isAdmin });
  const docs = usePatientDocuments(core.patient);

  return { ...core, ...vitals, ...docs };
}

export type PatientDetailHook = ReturnType<typeof usePatientDetail>;
