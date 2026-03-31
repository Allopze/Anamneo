import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientDetailPage from '@/app/(dashboard)/pacientes/[id]/page';

const pushMock = jest.fn();
const apiGetMock = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'patient-1' }),
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    isMedico: () => true,
    canEditAntecedentes: () => true,
    canEditPatientAdmin: () => true,
    canCreateEncounter: () => true,
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
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
    if (url === '/patients/patient-1') {
      return Promise.resolve({
        data: {
          id: 'patient-1',
          rut: '11.111.111-1',
          rutExempt: false,
          rutExemptReason: null,
          nombre: 'Paciente Demo',
          edad: 44,
          sexo: 'FEMENINO',
          trabajo: null,
          prevision: 'FONASA',
          domicilio: null,
          createdAt: '2026-03-31T08:00:00.000Z',
          updatedAt: '2026-03-31T08:00:00.000Z',
          history: undefined,
          problems: [],
          tasks: [],
        },
      });
    }

    if (url === '/patients/patient-1/encounters?page=1&limit=10') {
      return Promise.resolve({
        data: {
          data: [
            {
              id: 'enc-1',
              patientId: 'patient-1',
              createdById: 'user-1',
              status: 'COMPLETADO',
              reviewStatus: 'REVISADA_POR_MEDICO',
              createdAt: '2026-03-31T08:00:00.000Z',
              updatedAt: '2026-03-31T08:30:00.000Z',
              createdBy: { id: 'user-1', nombre: 'Dra. Rivera' },
              progress: { completed: 10, total: 10 },
              sections: [],
              tasks: [],
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 2,
          },
        },
      });
    }

    if (url === '/patients/patient-1/clinical-summary') {
      return Promise.resolve({
        data: {
          patientId: 'patient-1',
          generatedAt: '2026-03-31T09:00:00.000Z',
          counts: {
            totalEncounters: 2,
            activeProblems: 1,
            pendingTasks: 1,
          },
          latestEncounterSummary: {
            encounterId: 'enc-1',
            createdAt: '2026-03-31T08:00:00.000Z',
            lines: ['Dx: Migraña', 'Resumen: Paciente en mejoría.'],
          },
          vitalTrend: [
            {
              encounterId: 'enc-1',
              createdAt: '2026-03-31T08:00:00.000Z',
              presionArterial: '120/80',
              peso: 70,
              imc: 24.2,
              temperatura: 36.5,
              saturacionOxigeno: 98,
            },
          ],
          recentDiagnoses: [
            {
              label: 'Migraña',
              count: 2,
              lastSeenAt: '2026-03-31T08:00:00.000Z',
            },
          ],
          activeProblems: [],
          pendingTasks: [],
        },
      });
    }

    if (url === '/patients/patient-1/encounters?page=2&limit=10') {
      return Promise.resolve({
        data: {
          data: [
            {
              id: 'enc-2',
              patientId: 'patient-1',
              createdById: 'user-1',
              status: 'EN_PROGRESO',
              reviewStatus: 'NO_REQUIERE_REVISION',
              createdAt: '2026-03-30T10:00:00.000Z',
              updatedAt: '2026-03-30T10:20:00.000Z',
              createdBy: { id: 'user-1', nombre: 'Dra. Rivera' },
              progress: { completed: 3, total: 10 },
              sections: [],
              tasks: [],
            },
          ],
          pagination: {
            page: 2,
            limit: 10,
            total: 2,
            totalPages: 2,
          },
        },
      });
    }

    throw new Error(`Unexpected GET ${url}`);
  });
});

describe('PatientDetailPage', () => {
  it('paginates the encounter timeline through the paginated read model', async () => {
    render(<PatientDetailPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByText(/Atención del/i)).toBeInTheDocument();
    expect(await screen.findByText('Migraña · 2')).toBeInTheDocument();
    expect(screen.getByText('Resumen: Paciente en mejoría.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/patients/patient-1/encounters?page=2&limit=10');
    });

    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
  });
});
