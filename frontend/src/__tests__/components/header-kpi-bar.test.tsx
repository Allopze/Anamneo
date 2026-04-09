import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
    return Promise.resolve({ data: {} });
  });
});

const noop = () => {};

describe('SmartHeaderBar', () => {
  it('renders contextual KPI chips for /atenciones route', async () => {
    render(<SmartHeaderBar onSearchOpen={noop} />, { wrapper: createWrapper() });

    expect(await screen.findByLabelText('En progreso')).toBeInTheDocument();
    expect(await screen.findByLabelText('Completadas')).toBeInTheDocument();
    expect(await screen.findByLabelText('Canceladas')).toBeInTheDocument();
  });

  it('renders the alert badge with unacknowledged count', async () => {
    render(<SmartHeaderBar onSearchOpen={noop} />, { wrapper: createWrapper() });

    const badge = await screen.findByLabelText('3 alertas sin reconocer');
    expect(badge).toBeInTheDocument();
  });
});