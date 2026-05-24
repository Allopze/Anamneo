import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import PatientConsents from '@/components/PatientConsents';

const apiGetMock = jest.fn();
let authUser = { id: 'doctor-1', role: 'MEDICO' } as any;

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: jest.fn(),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector?: (state: any) => unknown) => {
      const state = { user: authUser };
      return selector ? selector(state) : state;
    }),
    {
      persist: { clearStorage: jest.fn() },
      setState: jest.fn(),
    },
  ),
  useAuthUser: () => authUser,
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
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('PatientConsents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authUser = { id: 'doctor-1', role: 'MEDICO' };
  });

  it('shows granted date, encounter provenance, and recorder information', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'consent-1',
            type: 'TRATAMIENTO',
            description: 'Acepta tratamiento indicado.',
            status: 'ACTIVO',
            encounterId: 'enc-123',
            grantedAt: '2026-04-19T10:00:00.000Z',
            createdAt: '2026-04-19T10:05:00.000Z',
            grantedBy: { nombre: 'Dra. Rivera' },
          },
        ],
        meta: { revokedHasMore: false },
      },
    });

    render(<PatientConsents patientId="patient-1" />, { wrapper: createWrapper() });

    expect(await screen.findByText('Registrado por Dra. Rivera')).toBeInTheDocument();
    expect(screen.getByText('Registro de consentimientos')).toBeInTheDocument();
    expect(screen.getByText(/Otorgado/i)).toBeInTheDocument();
    expect(screen.getByText('Asociado a la atención enc-123')).toBeInTheDocument();
  });

  it('uses assistant-specific copy for clinical consent evidence registration', async () => {
    authUser = { id: 'assistant-1', role: 'ASISTENTE', medicoId: 'doctor-1' };
    apiGetMock.mockResolvedValue({
      data: {
        data: [],
        meta: { revokedHasMore: false },
      },
    });

    render(<PatientConsents patientId="patient-1" />, { wrapper: createWrapper() });

    expect(await screen.findByText('Registrar evidencia')).toBeInTheDocument();
    expect(screen.queryByText('Registrar consentimiento')).not.toBeInTheDocument();
  });
});
