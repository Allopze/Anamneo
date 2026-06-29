import { renderHook } from '@testing-library/react';
import { useEncounterWizardDerived } from '@/app/(dashboard)/atenciones/[id]/useEncounterWizardDerived';

describe('useEncounterWizardDerived', () => {
  it('keeps a distinct label when offline queued saves finish syncing', () => {
    const encounter = {
      id: 'enc-1',
      status: 'EN_PROGRESO',
      reviewStatus: 'NO_REQUIERE_REVISION',
      patientId: 'patient-1',
      sections: [
        {
          id: 'sec-1',
          sectionKey: 'OBSERVACIONES',
          label: 'Observaciones',
          data: { observaciones: 'Texto sincronizado' },
          completed: true,
          notApplicable: false,
        },
      ],
      patient: {
        id: 'patient-1',
        nombre: 'Paciente Demo',
        completenessStatus: 'VERIFICADA',
      },
    } as any;

    const { result } = renderHook(() =>
      useEncounterWizardDerived({
        user: { id: 'med-1', role: 'MEDICO', isAdmin: false } as any,
        encounter,
        currentSectionIndex: 0,
        sections: encounter.sections,
        currentSection: encounter.sections[0],
        formData: { OBSERVACIONES: { observaciones: 'Texto sincronizado' } },
        savedSnapshotJson: JSON.stringify({ OBSERVACIONES: { observaciones: 'Texto sincronizado' } }),
        lastSavedAt: new Date(2026, 3, 18, 10, 15),
        lastSaveOrigin: 'offline-sync',
        saveStatus: 'idle',
        hasUnsavedChanges: false,
        savingSectionKey: null,
        errorSectionKey: null,
        savedSectionKey: null,
        attachments: [],
        uploadMeta: {
          category: 'GENERAL',
          description: '',
          linkedOrderType: '',
          linkedOrderId: '',
        },
        pendingSaveCount: 0,
      }),
    );

    expect(result.current.saveStateLabel).toMatch(/^Sincronizado desde cola a las /);
  });
});