import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import SeguimientosPage from '@/app/(dashboard)/seguimientos/page';
import type { User } from '@/stores/auth-store';

const replaceMock = jest.fn();
const apiGetMock = jest.fn();

let currentUser: User | null = {
  id: 'admin-1',
  email: 'admin@anamneo.cl',
  nombre: 'Admin Demo',
  role: 'ADMIN',
  isAdmin: true,
  medicoId: null,
};

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => '/seguimientos',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ user: currentUser }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('SeguimientosPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = {
      id: 'admin-1',
      email: 'admin@anamneo.cl',
      nombre: 'Admin Demo',
      role: 'ADMIN',
      isAdmin: true,
      medicoId: null,
    };
  });

  it('shows a redirect state for admin users instead of rendering a blank screen', async () => {
    render(<SeguimientosPage />, { wrapper: createWrapper() });

    expect(screen.getByText('Redirigiendo…')).toBeInTheDocument();
    expect(screen.getByText(/Esta bandeja clínica no está disponible para perfiles administrativos/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/');
    });

    expect(apiGetMock).not.toHaveBeenCalled();
  });
});