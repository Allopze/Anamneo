import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/(dashboard)/page';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: {
      id: 'med-1',
      nombre: 'Medico Demo',
      isAdmin: false,
    },
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

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/encounters/stats/dashboard') {
        return Promise.resolve({
          data: {
            counts: {
              enProgreso: 2,
              completado: 4,
              cancelado: 1,
              total: 7,
              pendingReview: 1,
              upcomingTasks: 4,
              overdueTasks: 2,
              dueTodayTasks: 1,
              dueThisWeekTasks: 3,
              upcomingAdministrativeTasks: 1,
              patientIncomplete: 1,
              patientPendingVerification: 2,
              patientVerified: 4,
              patientNonVerified: 3,
            },
            recent: [],
            upcomingTasks: [
              {
                id: 'task-1',
                patientId: 'patient-1',
                title: 'Firma pendiente',
                details: null,
                type: 'TRAMITE',
                priority: 'MEDIA',
                status: 'PENDIENTE',
                recurrenceRule: 'NONE',
                dueDate: '2026-04-18T00:00:00.000Z',
                isOverdue: false,
                patient: { id: 'patient-1', nombre: 'Paciente Demo', rut: '11.111.111-1' },
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('renders operational reminder cards for due tasks and administrative work', async () => {
    render(<DashboardPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Recordatorios operativos')).toBeInTheDocument();

    const overdueCard = (await screen.findByText('Vencidos')).closest('a');
    const todayCard = screen.getByText('Vencen hoy').closest('a');
    const weekCard = screen.getByText('Esta semana').closest('a');
    const administrativeCard = screen.getByText('Trámites próximos').closest('a');

    expect(overdueCard).toHaveAttribute('href', '/pacientes?taskWindow=OVERDUE');
    expect(todayCard).toHaveAttribute('href', '/pacientes?taskWindow=TODAY');
    expect(weekCard).toHaveAttribute('href', '/pacientes?taskWindow=THIS_WEEK');
    expect(administrativeCard).toHaveAttribute('href', '/seguimientos?type=TRAMITE');
  });
});