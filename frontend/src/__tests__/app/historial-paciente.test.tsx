import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import HistorialPacientePage from '@/app/(dashboard)/pacientes/[id]/historial/page';

const pushMock = jest.fn();
const apiGetMock = jest.fn();

const authStoreState = {
  canEditAntecedentes: jest.fn(() => false),
};

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'patient-1' }),
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => authStoreState,
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
    authStoreState.canEditAntecedentes.mockReturnValue(false);
  });

  it('redirects unauthorized users before fetching patient history data', async () => {
    render(<HistorialPacientePage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/pacientes/patient-1');
    });

    expect(apiGetMock).not.toHaveBeenCalled();
  });
});
