import { within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EncounterWizardPage from '@/app/(dashboard)/atenciones/[id]/page';
import toast from 'react-hot-toast';
import type { User } from '@/stores/auth-store';

const pushMock = jest.fn();
const replaceMock = jest.fn();
const apiGetMock = jest.fn();
const apiPostMock = jest.fn();
const apiPutMock = jest.fn();
const apiDeleteMock = jest.fn();

const authStoreState: {
  user: User | null;
  isMedico: () => boolean;
  canEditAntecedentes: () => boolean;
} = {
  user: {
    id: 'med-1',
    email: 'medico@anamneo.cl',
    nombre: 'Dra. Rivera',
    role: 'MEDICO',
    isAdmin: false,
    medicoId: null,
  },
  isMedico: () => true,
  canEditAntecedentes: () => true,
};

const encounterResponse = {
  id: 'enc-1',
  patientId: 'patient-1',
  createdById: 'med-1',
  status: 'EN_PROGRESO',
  reviewStatus: 'NO_REQUIERE_REVISION',
  reviewRequestedAt: null,
  reviewNote: null,
  reviewedAt: null,
  completedAt: null,
  closureNote: null,
  createdAt: '2026-04-08T12:00:00.000Z',
  updatedAt: '2026-04-08T12:00:00.000Z',
  patient: {
    id: 'patient-1',
    rut: '11.111.111-1',
    rutExempt: false,
    rutExemptReason: null,
    nombre: 'Paciente Demo',
    edad: 44,
    sexo: 'FEMENINO',
    trabajo: null,
    prevision: 'FONASA',
    domicilio: null,
    createdAt: '2026-04-08T12:00:00.000Z',
    updatedAt: '2026-04-08T12:00:00.000Z',
  },
  createdBy: {
    id: 'med-1',
    nombre: 'Dra. Rivera',
  },
  completedBy: null,
  reviewedBy: null,
  reviewRequestedBy: null,
  tasks: [],
  sections: [
    {
      id: 'sec-1',
      encounterId: 'enc-1',
      sectionKey: 'IDENTIFICACION',
      schemaVersion: 1,
      label: 'Identificación',
      order: 0,
      data: {
        nombre: 'Paciente Demo',
        rut: '11.111.111-1',
        rutExempt: false,
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
    {
      id: 'sec-2',
      encounterId: 'enc-1',
      sectionKey: 'MOTIVO_CONSULTA',
      schemaVersion: 1,
      label: 'Motivo de Consulta',
      order: 1,
      data: {
        texto: 'Consulta por cefalea persistente.',
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
    {
      id: 'sec-3',
      encounterId: 'enc-1',
      sectionKey: 'EXAMEN_FISICO',
      schemaVersion: 1,
      label: 'Examen Físico',
      order: 2,
      data: {
        peso: 70,
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
    {
      id: 'sec-4',
      encounterId: 'enc-1',
      sectionKey: 'SOSPECHA_DIAGNOSTICA',
      schemaVersion: 1,
      label: 'Sospecha Diagnóstica',
      order: 3,
      data: {
        diagnosticos: [{ label: 'Migraña', principal: true }],
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
    {
      id: 'sec-5',
      encounterId: 'enc-1',
      sectionKey: 'TRATAMIENTO',
      schemaVersion: 1,
      label: 'Tratamiento',
      order: 4,
      data: {
        plan: 'Manejo analgésico y control en 48 horas.',
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
  ],
};

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

  it('blocks completion from the page when the closure note is too short', async () => {
    const user = userEvent.setup();

    render(<EncounterWizardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Cierre' })[0]);
    await user.type(screen.getByLabelText('Nota de cierre'), 'corta');
    await user.click(screen.getByRole('button', { name: 'Finalizar Atención' }));

    expect(toast.error).toHaveBeenCalledWith('La nota de cierre debe tener al menos 15 caracteres');
    expect(screen.queryByRole('dialog', { name: 'Finalizar atención' })).not.toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalledWith('/encounters/enc-1/complete', expect.anything());
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

    await user.click(screen.getByRole('button', { name: 'Notas rápidas' }));
    await user.type(screen.getByPlaceholderText('Notas internas rápidas...'), 'Observación interna');
    await user.click(screen.getByRole('button', { name: 'Guardar y cerrar' }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/encounters/enc-1/sections/OBSERVACIONES', {
        data: { notasInternas: 'Observación interna' },
        completed: undefined,
      });
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        'La sección se guardó, pero no se pudo completar la verificación automática de alertas por signos vitales.',
        { icon: '⚠️' },
      );
    });

    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('Error al guardar'));
  });
});
