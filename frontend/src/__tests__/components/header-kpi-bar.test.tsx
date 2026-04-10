import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import SmartHeaderBar from '@/components/layout/SmartHeaderBar';

const apiGetMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => '/atenciones',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    canCreateEncounter: () => true,
    canCreatePatient: () => true,
  }),
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

beforeEach(() => {
  jest.clearAllMocks();
  apiGetMock.mockImplementation((url: string) => {
    if (url === '/encounters/stats/dashboard') {
      return Promise.resolve({
        data: {
          counts: {
            enProgreso: 3,
            completado: 8,
            cancelado: 1,
            total: 12,
            pendingReview: 2,
            upcomingTasks: 5,
            overdueTasks: 1,
            patientIncomplete: 2,
            patientPendingVerification: 2,
            patientVerified: 10,
            patientNonVerified: 4,
          },
        },
      });
    }
    if (url === '/alerts/unacknowledged-count') {
      return Promise.resolve({ data: { count: 3 } });
    }
    if (url === '/alerts/unacknowledged') {
      return Promise.resolve({
        data: {
          data: [
            {
              id: 'alert-1',
              type: 'SIGNOS_VITALES',
              severity: 'CRITICA',
              title: 'Presión arterial sistólica crítica',
              message: '190/120',
              createdAt: '2026-04-10T10:00:00Z',
              patient: { id: 'p-1', nombre: 'Juan Pérez' },
            },
            {
              id: 'alert-2',
              type: 'GENERAL',
              severity: 'MEDIA',
              title: 'Resultado pendiente',
              message: 'Hemograma',
              createdAt: '2026-04-10T09:00:00Z',
              patient: { id: 'p-2', nombre: 'María López' },
            },
          ],
        },
      });
    }
    return Promise.resolve({ data: {} });
  });
});

const noop = () => {};

describe('SmartHeaderBar', () => {
  it('renders contextual KPI chips for /atenciones route', async () => {
    render(<SmartHeaderBar onSearchOpen={noop} />, { wrapper: createWrapper() });

    // Both mobile and desktop chips render in JSDOM, so use findAll
    expect((await screen.findAllByLabelText('En progreso')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByLabelText('Completadas')).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByLabelText('Canceladas')).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the alert badge with unacknowledged count', async () => {
    render(<SmartHeaderBar onSearchOpen={noop} />, { wrapper: createWrapper() });

    const badge = await screen.findByLabelText('3 alertas sin reconocer');
    expect(badge).toBeInTheDocument();
  });

  it('opens the alert popover with alert list on click', async () => {
    render(<SmartHeaderBar onSearchOpen={noop} />, { wrapper: createWrapper() });

    const bell = await screen.findByLabelText('3 alertas sin reconocer');
    fireEvent.click(bell);

    expect(await screen.findByText('Presión arterial sistólica crítica')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Resultado pendiente')).toBeInTheDocument();
    expect(screen.getByText('María López')).toBeInTheDocument();
  });
});