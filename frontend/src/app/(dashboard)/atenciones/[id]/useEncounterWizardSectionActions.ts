import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import type { SectionKey } from '@/types';
import { TEMPLATE_FIELD_BY_SECTION } from './encounter-wizard.constants';

interface SaveSectionPayload {
  sectionKey: SectionKey;
  data: Record<string, unknown>;
  completed?: boolean;
  notApplicable?: boolean;
  notApplicableReason?: string;
}

interface UseEncounterWizardSectionActionsParams {
  canEdit: boolean;
  currentSection: { sectionKey: SectionKey } | undefined;
  formData: Partial<Record<SectionKey, Record<string, unknown>>>;
  handleSectionDataChange: (sectionKey: SectionKey, data: Record<string, unknown>) => void;
  saveSectionMutation: {
    mutateAsync: (payload: SaveSectionPayload) => Promise<unknown>;
  };
}

export function useEncounterWizardSectionActions(params: UseEncounterWizardSectionActionsParams) {
  const {
    canEdit,
    currentSection,
    formData,
    handleSectionDataChange,
    saveSectionMutation,
  } = params;

  const [showNotApplicableModal, setShowNotApplicableModal] = useState(false);
  const [notApplicableReason, setNotApplicableReason] = useState('');

  const insertTemplateIntoCurrentSection = useCallback(
    (content: string) => {
      if (!currentSection || !canEdit) return;

      const targetField = TEMPLATE_FIELD_BY_SECTION[currentSection.sectionKey];
      if (!targetField) return;

      const currentData = formData[currentSection.sectionKey] || {};
      const currentRaw = currentData[targetField];
      const existingValue = typeof currentRaw === 'string' ? currentRaw.trim() : '';
      const nextValue = existingValue ? `${existingValue}\n\n${content}`.trim() : content;

      handleSectionDataChange(currentSection.sectionKey, {
        ...currentData,
        [targetField]: nextValue,
      });
      toast.success('Plantilla insertada en la sección actual');
    },
    [canEdit, currentSection, formData, handleSectionDataChange],
  );

  const handleMarkNotApplicable = useCallback(() => {
    if (!canEdit || !currentSection) return;

    const requiredSections: SectionKey[] = [
      'MOTIVO_CONSULTA',
      'EXAMEN_FISICO',
      'SOSPECHA_DIAGNOSTICA',
      'TRATAMIENTO',
    ];

    if (requiredSections.includes(currentSection.sectionKey)) {
      toast.error('Esta sección es obligatoria y no se puede marcar como "No aplica"');
      return;
    }

    setNotApplicableReason('');
    setShowNotApplicableModal(true);
  }, [canEdit, currentSection]);

  const handleConfirmNotApplicable = useCallback(async () => {
    if (!currentSection) return;

    if (notApplicableReason.trim().length < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres');
      return;
    }

    const sectionKey = currentSection.sectionKey;
    const currentData = formData[sectionKey] ?? {};

    try {
      await saveSectionMutation.mutateAsync({
        sectionKey,
        data: currentData,
        completed: true,
        notApplicable: true,
        notApplicableReason: notApplicableReason.trim(),
      });
      setShowNotApplicableModal(false);
      toast.success('Sección marcada como no aplica');
    } catch {
      // onError handler already surfaces UI feedback
    }
  }, [currentSection, formData, notApplicableReason, saveSectionMutation]);

  return {
    showNotApplicableModal,
    setShowNotApplicableModal,
    notApplicableReason,
    setNotApplicableReason,
    insertTemplateIntoCurrentSection,
    handleMarkNotApplicable,
    handleConfirmNotApplicable,
  };
}
