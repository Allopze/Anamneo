'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import type { Patient } from '@/types';
import { notify } from '@/lib/notify';
import { downloadPatientExportBundle, downloadPatientHistoryPdf } from './patient-detail.helpers';

export function usePatientDocuments(patient: Patient | null | undefined) {
  const { id } = useParams<{ id: string }>();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingBundle, setExportingBundle] = useState(false);

  const handleExportHistorial = async () => {
    if (!patient || exportingPdf) return;
    setExportingPdf(true);
    try {
      await downloadPatientHistoryPdf(id, patient);
    } catch {
      notify.error('Error al exportar el historial clínico');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportBundle = async () => {
    if (!patient || exportingBundle) return;
    setExportingBundle(true);
    try {
      await downloadPatientExportBundle(id, patient);
    } catch {
      notify.error('Error al exportar el paquete clínico');
    } finally {
      setExportingBundle(false);
    }
  };

  return { exportingPdf, exportingBundle, handleExportHistorial, handleExportBundle };
}
