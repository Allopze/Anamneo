import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EncounterHeader from '@/app/(dashboard)/atenciones/[id]/EncounterHeader';

describe('EncounterHeader', () => {
  it('shows the follow-up action for a closed encounter and triggers it from the toolbar', async () => {
    const user = userEvent.setup();
    const handleDuplicate = jest.fn();

    render(
      <EncounterHeader
        encounter={{
          id: 'enc-1',
          patientId: 'patient-1',
          createdAt: '2026-04-17T10:00:00.000Z',
          reviewStatus: 'NO_REQUIERE_REVISION',
          patient: {
            nombre: 'Paciente Demo',
            rut: '11.111.111-1',
            edad: 44,
            edadMeses: 0,
            sexo: 'FEMENINO',
            prevision: 'FONASA',
          },
        } as any}
        sections={[{ id: 'sec-1', label: 'Motivo de consulta' } as any]}
        completedCount={1}
        progressPercentage={100}
        elapsedMinutes={30}
        isOnline={true}
        pendingSaveCount={0}
        canEdit={false}
        canDuplicateEncounter={true}
        canComplete={false}
        canSign={false}
        hasUnsavedChanges={false}
        saveStatus="idle"
        saveStateLabel=""
        saveStateToneClass=""
        drawerShortcutHint=""
        isDrawerOpen={false}
        setIsDrawerOpen={jest.fn()}
        completionBlockedReason={null}
        saveCurrentSection={jest.fn()}
        handleDuplicateEncounter={handleDuplicate}
        handleComplete={jest.fn()}
        handleViewFicha={jest.fn()}
        openDrawerTab={jest.fn()}
        saveSectionMutation={{ isPending: false } as any}
        duplicateEncounterMutation={{ isPending: false } as any}
        completeMutation={{ isPending: false } as any}
        signMutation={{ isPending: false } as any}
        setShowSignModal={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Nuevo seguimiento' }));

    expect(handleDuplicate).toHaveBeenCalledTimes(1);
  });
});