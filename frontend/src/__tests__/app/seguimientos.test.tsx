import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeguimientosPage from '@/app/(dashboard)/seguimientos/page';
import type { User } from '@/stores/auth-store';

const replaceMock = jest.fn();
const apiGetMock = jest.fn();
const apiPutMock = jest.fn();

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
    put: (...args: any[]) => apiPutMock(...args),
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
    apiPutMock.mockResolvedValue({ data: {} });
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

  it('shows priority badges and can reprogram a task quickly', async () => {
    currentUser = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
    };

    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'task-1',
            patientId: 'patient-1',
            title: 'Control prioritario',
            type: 'SEGUIMIENTO',
            priority: 'ALTA',
            status: 'PENDIENTE',
            recurrenceRule: 'NONE',
            dueDate: '2026-04-20T00:00:00.000Z',
            patient: {
              id: 'patient-1',
              nombre: 'Paciente Demo',
              rut: '11.111.111-1',
            },
          },
        ],
      },
    });

    const user = userEvent.setup();
    render(<SeguimientosPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Control prioritario')).toBeInTheDocument();
    expect(screen.getAllByText('Alta').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '+7 días' }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/patients/tasks/task-1', {
        dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });
  });
});