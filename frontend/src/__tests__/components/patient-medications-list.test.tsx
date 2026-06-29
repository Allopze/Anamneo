import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PatientMedicationsList from '@/components/PatientMedicationsList';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const apiGetMock = jest.fn();
const apiPostMock = jest.fn();
const apiPutMock = jest.fn();
const apiDeleteMock = jest.fn();
const notifySuccessMock = jest.fn();
const notifyErrorMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    put: (...args: unknown[]) => apiPutMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
  getErrorMessage: (e: unknown) => (e as Error)?.message ?? 'Error',
}));

jest.mock('@/lib/notify', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccessMock(...args),
    error: (...args: unknown[]) => notifyErrorMock(...args),
  },
}));

// Mock the auth store: default to medico so action buttons appear.
// Must include useAuthStore with persist/setState to satisfy the global test setup (setup.ts).
const isMedicoMock = jest.fn(() => true);
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector?: (state: unknown) => unknown) => {
      const state = { user: { id: 'doctor-1', role: 'MEDICO' } };
      return selector ? selector(state) : state;
    }),
    {
      persist: { clearStorage: jest.fn() },
      setState: jest.fn(),
    },
  ),
  useAuthIsMedico: () => isMedicoMock(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const MEDICATIONS = [
  {
    id: 'med-1',
    drug: 'Metformina',
    dose: '500 mg',
    route: 'Oral',
    frequency: 'Dos veces al día',
    status: 'ACTIVO' as const,
    startDate: null,
    notes: null,
    createdAt: '2026-05-30T00:00:00Z',
  },
  {
    id: 'med-2',
    drug: 'Aspirina',
    dose: '100 mg',
    route: 'Oral',
    frequency: 'Una vez al día',
    status: 'SUSPENDIDO' as const,
    startDate: null,
    notes: null,
    createdAt: '2026-05-29T00:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientMedicationsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra el estado vacío cuando no hay medicamentos', async () => {
    apiGetMock.mockResolvedValueOnce({ data: [] });

    render(<PatientMedicationsList patientId="patient-1" />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Sin medicamentos registrados/i)).toBeInTheDocument();
    });
  });

  it('renderiza la lista de medicamentos con estados correctos', async () => {
    apiGetMock.mockResolvedValueOnce({ data: MEDICATIONS });

    render(<PatientMedicationsList patientId="patient-1" />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Metformina')).toBeInTheDocument();
      expect(screen.getByText('Aspirina')).toBeInTheDocument();
    });
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('Suspendido')).toBeInTheDocument();
  });

  it('muestra el badge de activos en el encabezado', async () => {
    apiGetMock.mockResolvedValueOnce({ data: MEDICATIONS });

    render(<PatientMedicationsList patientId="patient-1" />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/1 activo/i)).toBeInTheDocument();
    });
  });

  it('muestra el formulario de agregar al hacer clic en Agregar', async () => {
    apiGetMock.mockResolvedValueOnce({ data: [] });

    render(<PatientMedicationsList patientId="patient-1" />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByText(/Sin medicamentos registrados/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Agregar'));
    expect(screen.getByPlaceholderText(/Metformina/i)).toBeInTheDocument();
  });

  it('crea un medicamento y muestra notificación de éxito', async () => {
    apiGetMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValueOnce({ data: { id: 'med-new' } });

    render(<PatientMedicationsList patientId="patient-1" />, { wrapper: makeWrapper() });

    await waitFor(() =>
      expect(screen.getByText(/Sin medicamentos registrados/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText('Agregar'));
    fireEvent.change(screen.getByPlaceholderText(/Metformina/i), {
      target: { value: 'Losartán' },
    });
    fireEvent.click(screen.getByText('Registrar medicamento'));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/patient-medications',
        expect.objectContaining({ drug: 'Losartán', patientId: 'patient-1' }),
      );
      expect(notifySuccessMock).toHaveBeenCalledWith('Medicamento registrado');
    });
  });

  it('no muestra botones de acción para ASISTENTE', async () => {
    isMedicoMock.mockReturnValue(false);
    apiGetMock.mockResolvedValueOnce({ data: MEDICATIONS });

    render(<PatientMedicationsList patientId="patient-1" />, { wrapper: makeWrapper() });

    await waitFor(() => expect(screen.getByText('Metformina')).toBeInTheDocument());

    expect(screen.queryByText('Agregar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Editar medicamento/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Eliminar medicamento/i)).not.toBeInTheDocument();
  });
});
