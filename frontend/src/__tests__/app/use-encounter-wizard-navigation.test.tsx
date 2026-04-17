import { act, renderHook } from '@testing-library/react';
import { useEncounterWizardNavigation } from '@/app/(dashboard)/atenciones/[id]/useEncounterWizardNavigation';

describe('useEncounterWizardNavigation', () => {
  const sections = [
    {
      id: 'sec-1',
      sectionKey: 'MOTIVO_CONSULTA',
      label: 'Motivo',
      completed: false,
      notApplicable: false,
    },
    {
      id: 'sec-2',
      sectionKey: 'TRATAMIENTO',
      label: 'Tratamiento',
      completed: false,
      notApplicable: false,
    },
  ] as any;

  beforeEach(() => {
    localStorage.clear();
  });

  it('does not advance when saving the current section fails', async () => {
    const setCurrentSectionIndex = jest.fn();
    const persistSection = jest.fn().mockRejectedValue(new Error('Validación')); 

    const { result } = renderHook(() =>
      useEncounterWizardNavigation({
        canEdit: true,
        currentSectionIndex: 0,
        currentSection: sections[0],
        hasUnsavedChanges: true,
        isSaving: false,
        saveCurrentSection: jest.fn().mockResolvedValue(undefined),
        persistSection,
        sections,
        setCurrentSectionIndex,
        startSectionTransition: (callback) => callback(),
      }),
    );

    await act(async () => {
      await result.current.handleNavigate('next');
    });

    expect(persistSection).toHaveBeenCalledWith({
      sectionKey: 'MOTIVO_CONSULTA',
      completed: true,
    });
    expect(setCurrentSectionIndex).not.toHaveBeenCalled();
  });

  it('advances only after the current section save completes', async () => {
    const setCurrentSectionIndex = jest.fn();
    const persistSection = jest.fn().mockResolvedValue('saved');

    const { result } = renderHook(() =>
      useEncounterWizardNavigation({
        canEdit: true,
        currentSectionIndex: 0,
        currentSection: sections[0],
        hasUnsavedChanges: true,
        isSaving: false,
        saveCurrentSection: jest.fn().mockResolvedValue(undefined),
        persistSection,
        sections,
        setCurrentSectionIndex,
        startSectionTransition: (callback) => callback(),
      }),
    );

    await act(async () => {
      await result.current.handleNavigate('next');
    });

    expect(persistSection).toHaveBeenCalledWith({
      sectionKey: 'MOTIVO_CONSULTA',
      completed: true,
    });
    expect(setCurrentSectionIndex).toHaveBeenCalledWith(1);
  });
});