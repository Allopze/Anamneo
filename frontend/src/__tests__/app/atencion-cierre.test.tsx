import { within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'enc-1' }),
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

jest.mock('next/dynamic', () => {
  return (_loader: unknown) => {
    const MockDynamicComponent = () => <div data-testid="dynamic-section" />;
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
  hasEncounterDraftUnsavedChanges: jest.fn(() => false),
  readEncounterDraft: jest.fn(() => null),
  writeEncounterDraft: jest.fn(),
}));

jest.mock('@/lib/clinical', () => ({
  buildGeneratedClinicalSummary: jest.fn(() => 'Resumen sugerido de cierre'),
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

describe('EncounterWizardPage closing workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    enqueueSaveMock.mockResolvedValue(undefined);
    getPendingSavesForUserMock.mockResolvedValue([]);
    removePendingSaveMock.mockResolvedValue(undefined);
    countPendingSavesForUserMock.mockResolvedValue(0);

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

  it('allows completion even without a closure note', async () => {
    const user = userEvent.setup();

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Cierre' })[0]);
    await user.click(screen.getByRole('button', { name: 'Finalizar Atención' }));

    expect(toast.error).not.toHaveBeenCalled();
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
                'La ficha maestra del paciente está pendiente de verificación médica antes de habilitar cierres y documentos clínicos oficiales.',
            },
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finalizar Atención' })).toBeDisabled();
    expect(screen.getAllByText(/pendiente de verificación médica/i)).toHaveLength(2);
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

    await user.click(screen.getAllByRole('button', { name: 'Cierre' })[0]);
    await user.type(
      screen.getByLabelText('Nota de cierre'),
      '  Paciente estable al cierre, con control y signos de alarma informados.  ',
    );
    await user.click(screen.getByRole('button', { name: 'Finalizar Atención' }));

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

    await user.click(screen.getAllByRole('button', { name: 'Apoyo' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Notas rápidas internas' })[0]);
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
      expect(enqueueSaveMock).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 'enc-1',
          sectionKey: 'OBSERVACIONES',
          completed: true,
          notApplicable: true,
          notApplicableReason: 'No corresponde para este seguimiento.',
          userId: 'med-1',
        }),
      );
    });
  });
});
