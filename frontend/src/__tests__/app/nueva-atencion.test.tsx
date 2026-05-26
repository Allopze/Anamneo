import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NuevaAtencionPage from '@/app/(dashboard)/atenciones/nueva/page';

const pushMock = jest.fn();
const apiGetMock = jest.fn();
const apiPostMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthUser: () => ({ id: 'assistant-1', role: 'ASISTENTE' }),
  useAuthCanCreateEncounter: () => true,
  useAuthIsMedico: () => false,
  useAuthStore: () => ({
    canCreateEncounter: () => true,
    isMedico: () => false,
    user: { id: 'assistant-1', role: 'ASISTENTE' },
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
  },
  getErrorMessage: (err: any) => err?.message || 'Error desconocido',
}));

jest.mock('@/lib/query-invalidation', () => ({
  invalidateDashboardOverviewQueries: jest.fn().mockResolvedValue(undefined),
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

const patient = {
  id: 'patient-1',
  rut: '11.111.111-1',
  rutExempt: false,
  rutExemptReason: null,
  nombre: 'Paciente Demo',
  fechaNacimiento: null,
  edad: 44,
  edadMeses: null,
  sexo: 'FEMENINO',
  trabajo: null,
  prevision: 'FONASA',
  registrationMode: 'RAPIDO',
  completenessStatus: 'PENDIENTE_VERIFICACION',
  demographicsMissingFields: [],
  domicilio: null,
  telefono: null,
  email: null,
  contactoEmergenciaNombre: null,
  contactoEmergenciaTelefono: null,
  centroMedico: null,
  createdAt: '2026-05-20T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
  _count: { encounters: 2 },
};

beforeEach(() => {
  jest.clearAllMocks();
  apiGetMock.mockResolvedValue({ data: { data: [patient] } });
  apiPostMock.mockResolvedValue({ data: { id: 'encounter-1' } });
});

describe('NuevaAtencionPage', () => {
  it('selects a patient before creating the prepared encounter', async () => {
    render(<NuevaAtencionPage />, { wrapper: createWrapper() });

    await userEvent.click(await screen.findByRole('button', { name: /Paciente Demo/i }));

    expect(await screen.findByText('Checklist pre-consulta')).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Crear atencion preparada/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/encounters/patient/patient-1', {});
    });
    expect(pushMock).toHaveBeenCalledWith('/atenciones/encounter-1');
  });
});
