import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PacientesPage from '@/app/(dashboard)/pacientes/page';

const pushMock = jest.fn();
const apiGetMock = jest.fn();
let currentSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentSearchParams,
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    canCreatePatient: () => true,
    canCreateEncounter: () => true,
    user: { isAdmin: false },
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const patientsResponse = {
  data: [
    {
      id: 'patient-1',
      rut: '11.111.111-1',
      rutExempt: false,
      rutExemptReason: null,
      nombre: 'Paciente Demo',
      edad: 44,
      edadMeses: null,
      sexo: 'FEMENINO',
      trabajo: null,
      prevision: 'FONASA',
      registrationMode: 'RAPIDO',
      completenessStatus: 'PENDIENTE_VERIFICACION',
      demographicsVerifiedAt: null,
      demographicsVerifiedById: null,
      demographicsMissingFields: [],
      domicilio: null,
      createdAt: '2026-03-31T08:00:00.000Z',
      updatedAt: '2026-03-31T08:00:00.000Z',
      _count: { encounters: 2 },
    },
  ],
  summary: {
    totalPatients: 7,
    incomplete: 1,
    pendingVerification: 2,
    verified: 4,
    nonVerified: 3,
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 2,
    totalPages: 1,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  currentSearchParams = new URLSearchParams();
  apiGetMock.mockImplementation((url: string) => {
    if (url.startsWith('/patients?')) {
      return Promise.resolve({ data: patientsResponse });
    }

    throw new Error(`Unexpected GET ${url}`);
  });
});

describe('PacientesPage', () => {
  it('shows operational completeness summary cards and applies the selected summary filter', async () => {
    render(<PacientesPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Fichas incompletas')).toBeInTheDocument();
    expect(screen.getByText('Universo visible: 7 fichas. No verificadas: 3.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Pendientes de validación/i }));

    expect(pushMock).toHaveBeenCalledWith('/pacientes?completenessStatus=PENDIENTE_VERIFICACION');
  });

  it('includes the completeness filter from the URL when requesting patients', async () => {
    currentSearchParams = new URLSearchParams('completenessStatus=PENDIENTE_VERIFICACION');

    render(<PacientesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/patients?page=1&limit=10&completenessStatus=PENDIENTE_VERIFICACION&sortBy=createdAt&sortOrder=desc',
      );
    });

    expect(
      await screen.findByText(/Mostrando 2 registros dentro del filtro pendiente de verificación médica\./i),
    ).toBeInTheDocument();
  });
});