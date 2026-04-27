import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EncounterHeader from '@/app/(dashboard)/atenciones/[id]/EncounterHeader';
import EncounterToolbar from '@/app/(dashboard)/atenciones/[id]/EncounterToolbar';

// Stub the HeaderBarSlotContext so the toolbar renders its fallback inline
jest.mock('@/components/layout/HeaderBarSlotContext', () => ({
  useHeaderBarSlot: () => null,
}));

describe('EncounterToolbar', () => {
  it('shows the follow-up action for a closed encounter and triggers it from the toolbar', async () => {
    const user = userEvent.setup();
    const handleDuplicate = jest.fn();

    render(
      <EncounterToolbar
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
        canEdit={false}
        canDuplicateEncounter={true}
        canComplete={false}
        canSign={false}
        hasUnsavedChanges={false}
        saveStatus="idle"
        saveStateLabel=""
        canViewAudit={false}
        completionBlockedReason={null}
        saveCurrentSection={jest.fn()}
        handleDuplicateEncounter={handleDuplicate}
        handleComplete={jest.fn()}
        handleViewFicha={jest.fn()}
        openWorkspacePanel={jest.fn()}
        saveSectionMutation={{ isPending: false } as any}
        duplicateEncounterMutation={{ isPending: false } as any}
        completeMutation={{ isPending: false } as any}
        signMutation={{ isPending: false } as any}
        setShowSignModal={jest.fn()}
      />,
    );

    // The button is inside the "Más" dropdown menu
    await user.click(screen.getByRole('button', { name: 'Más acciones de atención' }));
    await user.click(screen.getByText('Nuevo seguimiento'));

    expect(handleDuplicate).toHaveBeenCalledTimes(1);
  });
});

describe('EncounterHeader', () => {
  it('surfaces queued offline saves clearly in the header state badges', () => {
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
        completedCount={0}
        progressPercentage={0}
        elapsedMinutes={30}
        isOnline={false}
        pendingSaveCount={1}
      />,
    );

    expect(screen.getByText('Sin conexión · 1 pendiente')).toBeInTheDocument();
  });
});
