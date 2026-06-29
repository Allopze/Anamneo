import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { notify } from '@/lib/notify';
import type { Encounter, IdentificacionData, SectionKey } from '@/types';

interface UseEncounterSectionActionsParams {
  encounter: Encounter | undefined;
  id: string;
  queryClient: QueryClient;
  formData: Record<string, any>;
  lastSavedRef: MutableRefObject<string>;
  setSavedSnapshotJson: React.Dispatch<React.SetStateAction<string>>;
  setDirtySectionKeys: React.Dispatch<React.SetStateAction<Set<SectionKey>>>;
  handleSectionDataChange: (sectionKey: SectionKey, data: any) => void;
  saveSection: (args: { sectionKey: SectionKey; data: any }) => Promise<string | null>;
}

/**
 * Higher-level section actions that either call the backend directly
 * (reconcile identification) or compose handleSectionDataChange + saveSection
 * (generated summary, quick notes).
 */
export function useEncounterSectionActions({
  encounter,
  id,
  queryClient,
  formData,
  lastSavedRef,
  setSavedSnapshotJson,
  setDirtySectionKeys,
  handleSectionDataChange,
  saveSection,
}: UseEncounterSectionActionsParams) {
  const handleRestoreIdentificationFromPatient = useCallback(async () => {
    if (!encounter) return;

    try {
      const response = await api.post(`/encounters/${id}/reconcile-identification`);
      const reconciledData = response.data.data as IdentificacionData;
      handleSectionDataChange('IDENTIFICACION', reconciledData);

      let snapshot: Record<string, any> = {};
      try {
        snapshot = JSON.parse(lastSavedRef.current || '{}');
      } catch {
        snapshot = {};
      }

      snapshot.IDENTIFICACION = reconciledData;
      lastSavedRef.current = JSON.stringify(snapshot);
      setSavedSnapshotJson(lastSavedRef.current);
      setDirtySectionKeys((current) => {
        if (!current.has('IDENTIFICACION')) return current;
        const next = new Set(current);
        next.delete('IDENTIFICACION');
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['encounter', id] });
      notify.success('Se actualizó la identificación con datos de la ficha del paciente');
    } catch (error) {
      notify.error(getErrorMessage(error));
    }
  }, [encounter, handleSectionDataChange, id, lastSavedRef, queryClient, setDirtySectionKeys, setSavedSnapshotJson]);

  const handleSaveGeneratedSummary = useCallback(
    async (generatedSummary: string) => {
      const existing = formData.OBSERVACIONES || {};
      const updatedData = { ...existing, resumenClinico: generatedSummary };
      handleSectionDataChange('OBSERVACIONES', updatedData);
      const result = await saveSection({ sectionKey: 'OBSERVACIONES', data: updatedData });
      if (result === 'saved') {
        notify.success('Resumen longitudinal guardado');
      }
    },
    [formData.OBSERVACIONES, handleSectionDataChange, saveSection],
  );

  const handleQuickNotesSave = useCallback(
    async (text: string) => {
      const existing = formData.OBSERVACIONES || {};
      const updatedData = { ...existing, notasInternas: text };
      handleSectionDataChange('OBSERVACIONES', updatedData);
      await saveSection({ sectionKey: 'OBSERVACIONES', data: updatedData });
    },
    [formData.OBSERVACIONES, handleSectionDataChange, saveSection],
  );

  return {
    handleRestoreIdentificationFromPatient,
    handleSaveGeneratedSummary,
    handleQuickNotesSave,
  };
}
