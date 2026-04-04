import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import HistorialPacientePage from '@/app/(dashboard)/pacientes/[id]/historial/page';
import permissionContract from '../../../../shared/permission-contract.json';

const pushMock = jest.fn();
const apiGetMock = jest.fn();
let currentUser = permissionContract[0].user as any;

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'patient-1' }),
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => {
    const permissions = jest.requireActual('@/lib/permissions');
    return {
      canEditAntecedentes: () => permissions.canEditAntecedentes(currentUser),
    };
  },
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    put: jest.fn(),
  },
  getErrorMessage: (err: any) => err?.message || 'Error desconocido',
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
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

describe('HistorialPacientePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = permissionContract.find((scenario) => scenario.id === 'assistant_unassigned')?.user as any;
  });

  it('redirects unauthorized users before fetching patient history data', async () => {
    render(<HistorialPacientePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/pacientes/patient-1');
    });

    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it.each(permissionContract.filter((scenario) => scenario.expectations.canEditAntecedentes))(
    'allows $id to fetch patient history',
    async ({ user }) => {
      currentUser = user as any;
      apiGetMock.mockResolvedValue({
        data: {
          id: 'patient-1',
          nombre: 'Paciente Demo',
          history: {},
        },
      });

      render(<HistorialPacientePage />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(apiGetMock).toHaveBeenCalledWith('/patients/patient-1');
      });

      expect(pushMock).not.toHaveBeenCalled();
    },
  );
});
