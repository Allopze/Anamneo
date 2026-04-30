import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
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
            activeEncounters: [
              {
                id: 'enc-active-1',
                patientId: 'patient-active-1',
                patientName: 'Paciente Activo',
                patientRut: '22.222.222-2',
                createdByName: 'Medico Demo',
                status: 'EN_PROGRESO',
                createdAt: '2026-04-18T18:00:00.000Z',
                updatedAt: '2026-04-18T19:00:00.000Z',
                progress: { completed: 3, total: 10 },
              },
            ],
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

    expect(await screen.findByText('Paciente Activo')).toBeInTheDocument();
    expect(screen.getByText('Recordatorios operativos')).toBeInTheDocument();
    expect(screen.getByText('Retomar')).toBeInTheDocument();
    expect(screen.queryByText('Siguiente acción')).not.toBeInTheDocument();

    const overdueCard = (await screen.findByText('Vencidos')).closest('a');
    const todayCard = screen.getByText('Vencen hoy').closest('a');
    const weekCard = screen.getByText('Esta semana').closest('a');
    const administrativeCard = screen.getByText('Trámites próximos').closest('a');

    expect(overdueCard).toHaveAttribute('href', '/pacientes?taskWindow=OVERDUE');
    expect(todayCard).toHaveAttribute('href', '/pacientes?taskWindow=TODAY');
    expect(weekCard).toHaveAttribute('href', '/pacientes?taskWindow=THIS_WEEK');
    expect(administrativeCard).toHaveAttribute('href', '/seguimientos?type=TRAMITE');
  });

  it('renders a compact empty state when there are no active encounters', async () => {
    apiGetMock.mockImplementationOnce(() =>
      Promise.resolve({
        data: {
          counts: {
            enProgreso: 0,
            completado: 4,
            cancelado: 1,
            total: 5,
            pendingReview: 0,
            upcomingTasks: 0,
            overdueTasks: 0,
            dueTodayTasks: 0,
            dueThisWeekTasks: 0,
            upcomingAdministrativeTasks: 0,
            patientIncomplete: 1,
            patientPendingVerification: 2,
            patientVerified: 4,
            patientNonVerified: 3,
          },
          activeEncounters: [],
          recent: [],
          upcomingTasks: [],
        },
      }),
    );

    render(<DashboardPage />, { wrapper: createWrapper() });

    await screen.findByText('No hay atenciones en progreso en este momento.');
    const activeSection = screen.getByText('Atenciones en curso').closest('section');

    expect(activeSection).toBeTruthy();
    expect(within(activeSection as HTMLElement).getByText('No hay atenciones en progreso en este momento.')).toBeInTheDocument();
    expect(screen.queryByText('Siguiente acción')).not.toBeInTheDocument();
    expect(screen.getByText('No hay seguimientos próximos cargados en el tablero.')).toBeInTheDocument();
  });
});
