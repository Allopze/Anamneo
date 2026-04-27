import { within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EncounterWizardPage from '@/app/(dashboard)/atenciones/[id]/page';
import toast from 'react-hot-toast';
import { authStoreState, encounterResponse } from './atencion-cierre.fixtures';

const pushMock = jest.fn();
const replaceMock = jest.fn();
const apiGetMock = jest.fn();
const apiPostMock = jest.fn();
const apiPutMock = jest.fn();
const apiDeleteMock = jest.fn();
const enqueueSaveMock = jest.fn();
const getPendingSavesForUserMock = jest.fn();
const removePendingSaveMock = jest.fn();
const countPendingSavesForUserMock = jest.fn();
const clearEncounterSectionConflictMock = jest.fn();
const listEncounterSectionConflictsMock = jest.fn();
const readEncounterSectionConflictMock = jest.fn();
const readEncounterDraftMock = jest.fn();
const hasEncounterDraftUnsavedChangesMock = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'enc-1' }),
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

jest.mock('next/dynamic', () => {
  return (_loader: unknown) => {
    const MockDynamicComponent = ({ data = {}, onChange }: any) => (
      <div data-testid="dynamic-section">
        <label htmlFor="dynamic-section-input">Campo clínico</label>
        <input
          id="dynamic-section-input"
          value={data.__text ?? ''}
          onChange={(event) => onChange?.({ ...data, __text: event.target.value })}
        />
      </div>
    );
    MockDynamicComponent.displayName = 'MockDynamicComponent';
    return MockDynamicComponent;
  };
});

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => authStoreState,
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
    put: (...args: any[]) => apiPutMock(...args),
    delete: (...args: any[]) => apiDeleteMock(...args),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('@/lib/offline-queue', () => ({
  enqueueSave: (...args: any[]) => enqueueSaveMock(...args),
  getPendingSavesForUser: (...args: any[]) => getPendingSavesForUserMock(...args),
  removePendingSave: (...args: any[]) => removePendingSaveMock(...args),
  countPendingSavesForUser: (...args: any[]) => countPendingSavesForUserMock(...args),
  isNetworkError: (error: any) => error?.code === 'ERR_NETWORK' || !error?.response,
}));

jest.mock('@/lib/encounter-draft', () => ({
  clearEncounterDraft: jest.fn(),
  clearEncounterSectionConflict: (...args: any[]) => clearEncounterSectionConflictMock(...args),
  hasEncounterDraftUnsavedChanges: (...args: any[]) => hasEncounterDraftUnsavedChangesMock(...args),
  listEncounterSectionConflicts: (...args: any[]) => listEncounterSectionConflictsMock(...args),
  readEncounterDraft: (...args: any[]) => readEncounterDraftMock(...args),
  readEncounterSectionConflict: (...args: any[]) => readEncounterSectionConflictMock(...args),
  writeEncounterSectionConflict: jest.fn(),
  writeEncounterDraft: jest.fn(),
}));

jest.mock('@/lib/clinical', () => {
  const actual = jest.requireActual('@/lib/clinical');
  return {
    ...actual,
    buildGeneratedClinicalSummary: jest.fn(() => 'Resumen sugerido de cierre'),
  };
});

jest.mock('@/components/layout/HeaderBarSlotContext', () => ({
  useHeaderBarSlot: () => null,
}));

jest.mock('@/components/ClinicalAlerts', () => () => null);
jest.mock('@/components/TemplateSelector', () => () => null);

jest.mock('@/components/common/ConfirmModal', () => ({
  __esModule: true,
  default: ({ isOpen, title, message, confirmLabel, onConfirm, onClose, loading }: any) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={loading}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function openWorkspaceTool(user: ReturnType<typeof userEvent.setup>, tabName: 'Cierre' | 'Apoyo' | 'Revisión') {
  if (tabName === 'Cierre') {
    await screen.findByRole('heading', { name: 'Cierre' });
    return;
  }

  if (tabName === 'Revisión') {
    await user.click(screen.getByRole('button', { name: /Estado de revisión/i }));
    await screen.findByRole('heading', { name: 'Revisión' });
    return;
  }

  await user.click(screen.getByRole('button', { name: 'Más acciones de atención' }));
  await user.click(screen.getByText('Apoyo clínico'));
  await screen.findByRole('heading', { name: 'Apoyo clínico' });
}

describe('EncounterWizardPage closing workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStoreState.user = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Dra. Rivera',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
    };
    authStoreState.isMedico = () => true;
    authStoreState.canCreateEncounter = () => true;
    authStoreState.canEditAntecedentes = () => true;
    enqueueSaveMock.mockResolvedValue(undefined);
    getPendingSavesForUserMock.mockResolvedValue([]);
    removePendingSaveMock.mockResolvedValue(undefined);
    countPendingSavesForUserMock.mockResolvedValue(0);
    clearEncounterSectionConflictMock.mockReset();
    listEncounterSectionConflictsMock.mockReset();
    readEncounterSectionConflictMock.mockReset();
    readEncounterDraftMock.mockReset();
    hasEncounterDraftUnsavedChangesMock.mockReset();
    listEncounterSectionConflictsMock.mockReturnValue([]);
    readEncounterSectionConflictMock.mockReturnValue(null);
    readEncounterDraftMock.mockReturnValue(null);
    hasEncounterDraftUnsavedChangesMock.mockReturnValue(false);

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/encounters/enc-1') {
        return Promise.resolve({ data: encounterResponse });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    apiPostMock.mockImplementation((url: string, payload: unknown) => {
      if (url === '/encounters/enc-1/complete') {
        return Promise.resolve({
          data: {
            ...encounterResponse,
            status: 'COMPLETADO',
            closureNote: (payload as { closureNote: string }).closureNote,
          },
        });
      }

      throw new Error(`Unexpected POST ${url}`);
    });

    apiPutMock.mockResolvedValue({ data: { data: {}, completed: true } });
    apiDeleteMock.mockResolvedValue({ data: {} });
  });

  it('blocks completion until a closure note is provided', async () => {
    const user = userEvent.setup();

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await openWorkspaceTool(user, 'Cierre');
    await user.click(screen.getByRole('button', { name: /Finalizar/i }));

    expect(toast.error).toHaveBeenCalledWith('La nota de cierre debe tener al menos 10 caracteres');
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('disables encounter completion when the patient record is pending medical verification', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/encounters/enc-1') {
        return Promise.resolve({
          data: {
            ...encounterResponse,
            patient: {
              ...encounterResponse.patient,
              registrationMode: 'RAPIDO',
              completenessStatus: 'PENDIENTE_VERIFICACION',
              demographicsMissingFields: [],
            },
            clinicalOutputBlock: {
              completenessStatus: 'PENDIENTE_VERIFICACION',
              missingFields: [],
              blockedActions: ['COMPLETE_ENCOUNTER', 'EXPORT_OFFICIAL_DOCUMENTS', 'PRINT_CLINICAL_RECORD'],
              reason:
                'La ficha del paciente está pendiente de verificación médica antes de habilitar cierres y documentos clínicos oficiales.',
            },
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finalizar/i })).toBeDisabled();
    expect(screen.getAllByText(/pendiente de verificación médica/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('link', { name: 'Revisar ficha administrativa' })).toHaveAttribute(
      'href',
      '/pacientes/patient-1',
    );
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('opens the confirmation modal and sends the normalized closure note when valid', async () => {
    const user = userEvent.setup();

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await openWorkspaceTool(user, 'Cierre');
    const closureNoteField = screen.getByLabelText('Nota de cierre');
    fireEvent.change(closureNoteField, {
      target: { value: '  Paciente estable al cierre, con control y signos de alarma informados.  ' },
    });
    await user.click(screen.getByRole('button', { name: /Finalizar/i }));

    const dialog = await screen.findByRole('dialog', { name: 'Finalizar atención' });
    expect(dialog).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Finalizar atención' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/encounters/enc-1/complete', {
        closureNote: 'Paciente estable al cierre, con control y signos de alarma informados.',
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/atenciones/enc-1/ficha');
    });
  });

  it('shows an explicit pre-close checklist in the cierre workspace section', async () => {
    const user = userEvent.setup();

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await openWorkspaceTool(user, 'Cierre');

    expect(screen.getByText('Checklist de pre-cierre')).toBeInTheDocument();
    expect(screen.getByText('Secciones obligatorias completas')).toBeInTheDocument();
    expect(screen.getByText('Contenido clínico esencial')).toBeInTheDocument();
    expect(screen.getAllByText('Nota de cierre').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Ficha del paciente lista para cierre')).toBeInTheDocument();
  });

  it('shows a recoverable conflict banner and lets the user dismiss the local copy', async () => {
    const user = userEvent.setup();
    const conflict = {
      version: 2,
      encounterId: 'enc-1',
      userId: 'med-1',
      sectionKey: 'IDENTIFICACION',
      localData: { nombre: 'Paciente Demo' },
      serverData: { nombre: 'Paciente Demo', rut: '11.111.111-1' },
      serverUpdatedAt: '2026-04-19T10:00:00.000Z',
      savedAt: '2026-04-19T10:01:00.000Z',
    };
    readEncounterSectionConflictMock.mockReturnValue(conflict);
    listEncounterSectionConflictsMock.mockReturnValue([conflict]);
    readEncounterDraftMock.mockReturnValue({
      version: 2,
      encounterId: 'enc-1',
      userId: 'med-1',
      currentSectionIndex: 2,
      formData: { IDENTIFICACION: { nombre: 'Paciente Demo' } },
      savedSnapshot: { IDENTIFICACION: { nombre: '' } },
      savedAt: '2026-04-19T09:59:00.000Z',
    });
    hasEncounterDraftUnsavedChangesMock.mockReturnValue(true);

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();
    expect(screen.getByText(/borradores y conflictos listos para revisar/i)).toBeInTheDocument();
    expect(screen.getByText(/borrador local activo/i)).toBeInTheDocument();
    expect(screen.getByText('Campo')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Restaurar mi copia/i }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Descartar' }));

    expect(clearEncounterSectionConflictMock).toHaveBeenCalledWith('enc-1', 'med-1', 'IDENTIFICACION');
    expect(toast.success).toHaveBeenCalledWith('Se descartó la copia local en conflicto.');
  });

  it('does not show the recovery panel for the live draft created in the current session', async () => {
    const user = userEvent.setup();
    let draftReads = 0;

    readEncounterDraftMock.mockImplementation(() => {
      draftReads += 1;

      if (draftReads === 1) {
        return null;
      }

      return {
        version: 2,
        encounterId: 'enc-1',
        userId: 'med-1',
        currentSectionIndex: 0,
        formData: { IDENTIFICACION: { __text: 'Borrador activo de la sesión' } },
        savedSnapshot: { IDENTIFICACION: {} },
        savedAt: '2026-04-19T09:59:00.000Z',
      };
    });
    hasEncounterDraftUnsavedChangesMock.mockImplementation((draft) => {
      if (!draft) {
        return false;
      }

      return JSON.stringify(draft.formData) !== JSON.stringify(draft.savedSnapshot);
    });

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Campo clínico'), 'abc');

    expect(screen.queryByText(/borradores y conflictos listos para revisar/i)).not.toBeInTheDocument();
  });

  it('keeps the completion action available for the treating doctor even when the encounter was created by an assistant', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/encounters/enc-1') {
        return Promise.resolve({
          data: {
            ...encounterResponse,
            createdById: 'assistant-1',
            createdBy: {
              id: 'assistant-1',
              nombre: 'Asistente Clínica',
            },
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finalizar/i })).toBeEnabled();
  });

  it('keeps the review note editable for a doctor who can still mark a completed encounter as reviewed', async () => {
    const user = userEvent.setup();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/encounters/enc-1') {
        return Promise.resolve({
          data: {
            ...encounterResponse,
            status: 'COMPLETADO',
            reviewStatus: 'NO_REQUIERE_REVISION',
            completedAt: '2026-04-08T12:30:00.000Z',
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await openWorkspaceTool(user, 'Revisión');
    expect(screen.getByLabelText('Nota de revisión')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Marcar Revisada' })).toBeInTheDocument();
  });

  it('hides follow-up creation for users without explicit task permission', async () => {
    const user = userEvent.setup();
    authStoreState.user = {
      id: 'assistant-2',
      email: 'asistente@anamneo.cl',
      nombre: 'Asistente sin médico',
      role: 'ASISTENTE',
      isAdmin: false,
      medicoId: null,
    };
    authStoreState.isMedico = () => false;
    authStoreState.canEditAntecedentes = () => false;

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await openWorkspaceTool(user, 'Apoyo');
    expect(screen.queryByText('Seguimiento Rápido')).not.toBeInTheDocument();
  });

  it('shows a non-blocking warning toast when automatic vital-sign alerts could not be generated', async () => {
    const user = userEvent.setup();

    apiPutMock.mockResolvedValueOnce({
      data: {
        data: JSON.stringify({ notasInternas: 'Observación interna' }),
        completed: false,
        warnings: [
          'La sección se guardó, pero no se pudo completar la verificación automática de alertas por signos vitales.',
        ],
      },
    });

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await openWorkspaceTool(user, 'Apoyo');
    await user.click(screen.getByRole('button', { name: 'Notas rápidas internas' }));
    await user.type(screen.getByPlaceholderText('Notas internas rápidas...'), 'Observación interna');
    await user.click(screen.getByTitle('Guardar y cerrar'));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith(
        '/encounters/enc-1/sections/OBSERVACIONES',
        expect.objectContaining({
          data: {
            observaciones: '',
            notasInternas: 'Observación interna',
          },
          completed: undefined,
        }),
      );
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        'La sección se guardó, pero no se pudo completar la verificación automática de alertas por signos vitales.',
        { icon: '⚠️' },
      );
    });

    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('Error al guardar'));
  });

  it('keeps notApplicable fields when a not-applicable save falls back to the offline queue', async () => {
    const user = userEvent.setup();

    apiPutMock.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
    countPendingSavesForUserMock.mockResolvedValueOnce(1);

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Observaciones/i })[0]);
    expect(await screen.findByRole('heading', { name: 'Observaciones' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'No aplica' }));
    await user.type(screen.getByPlaceholderText(/Paciente pediátrico/i), 'No corresponde para este seguimiento.');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith(
        '/encounters/enc-1/sections/OBSERVACIONES',
        expect.objectContaining({
          data: {
            observaciones: '',
            notasInternas: '',
          },
          baseUpdatedAt: '2026-04-08T12:00:00.000Z',
          completed: true,
          notApplicable: true,
          notApplicableReason: 'No corresponde para este seguimiento.',
        }),
      );
    });

    await waitFor(() => {
      expect(enqueueSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 'enc-1',
          sectionKey: 'OBSERVACIONES',
          baseUpdatedAt: '2026-04-08T12:00:00.000Z',
          completed: true,
          notApplicable: true,
          notApplicableReason: 'No corresponde para este seguimiento.',
          userId: 'med-1',
        }),
      );
    });
  });

});
