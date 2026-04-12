import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientDetailPage from '@/app/(dashboard)/pacientes/[id]/page';
import permissionContract from '../../../../shared/permission-contract.json';

const pushMock = jest.fn();
const apiGetMock = jest.fn();
const apiPostMock = jest.fn();
let currentUser = permissionContract[0].user as any;

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'patient-1' }),
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => {
    const permissions = jest.requireActual('@/lib/permissions');
    return {
      isMedico: () => permissions.isMedicoUser(currentUser),
      canEditAntecedentes: () => permissions.canEditAntecedentes(currentUser),
      canEditPatientAdmin: () => permissions.canEditPatientAdmin(currentUser),
      canCreateEncounter: () => permissions.canCreateEncounter(currentUser),
    };
  },
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
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
  currentUser = permissionContract.find((scenario) => scenario.id === 'medico')?.user as any;

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
          registrationMode: 'COMPLETO',
          completenessStatus: 'VERIFICADA',
          demographicsVerifiedAt: '2026-03-31T08:00:00.000Z',
          demographicsVerifiedById: 'user-1',
          demographicsMissingFields: [],
          domicilio: null,
          createdAt: '2026-03-31T08:00:00.000Z',
          updatedAt: '2026-03-31T08:00:00.000Z',
          history: {},
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

  it('shows vital selector pills and expanded chart when full vitals are toggled', async () => {
    const originalImpl = apiGetMock.getMockImplementation()!;
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/patients/patient-1/clinical-summary?vitalHistory=full') {
        return Promise.resolve({
          data: {
            patientId: 'patient-1',
            generatedAt: '2026-03-31T09:00:00.000Z',
            counts: { totalEncounters: 5, activeProblems: 0, pendingTasks: 0 },
            latestEncounterSummary: null,
            vitalTrend: [
              { encounterId: 'enc-1', createdAt: '2026-03-31T08:00:00.000Z', presionArterial: '120/80', peso: 70, imc: 24.2, temperatura: 36.5, saturacionOxigeno: 98 },
              { encounterId: 'enc-2', createdAt: '2026-03-28T08:00:00.000Z', presionArterial: '118/78', peso: 69, imc: 23.8, temperatura: 36.7, saturacionOxigeno: 97 },
            ],
            recentDiagnoses: [],
            activeProblems: [],
            pendingTasks: [],
          },
        });
      }
      return originalImpl(url);
    });

    render(<PatientDetailPage />, { wrapper: createWrapper() });

    // Wait for summary to render, then toggle full vitals
    expect(await screen.findByText('Ver historial completo')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Ver historial completo'));

    // Should now show selector pills
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Peso' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'IMC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'T°' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SatO₂' })).toBeInTheDocument();

    // Toggle button should now say "Ver resumen"
    expect(screen.getByText('Ver resumen')).toBeInTheDocument();
  });

  it.each(permissionContract)(
    'shows antecedentes edit action according to permission contract for $id',
    async ({ user, expectations }) => {
      currentUser = user as any;

      render(<PatientDetailPage />, { wrapper: createWrapper() });

      expect(await screen.findByText('Antecedentes')).toBeInTheDocument();
      const editLinks = screen.queryAllByRole('link', { name: 'Editar' });
      const historyEditLink = editLinks.find(
        (link) => link.getAttribute('href') === '/pacientes/patient-1/historial',
      );

      if (expectations.canEditAntecedentes) {
        expect(historyEditLink).toBeDefined();
        return;
      }

      expect(historyEditLink).toBeUndefined();
    },
  );

  it('allows a doctor to verify a pending patient record from the detail page', async () => {
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
            registrationMode: 'RAPIDO',
            completenessStatus: 'PENDIENTE_VERIFICACION',
            demographicsVerifiedAt: null,
            demographicsVerifiedById: null,
            demographicsMissingFields: [],
            domicilio: null,
            createdAt: '2026-03-31T08:00:00.000Z',
            updatedAt: '2026-03-31T08:00:00.000Z',
            history: {},
            problems: [],
            tasks: [],
          },
        });
      }

      if (url === '/patients/patient-1/encounters?page=1&limit=10') {
        return Promise.resolve({
          data: {
            data: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          },
        });
      }

      if (url === '/patients/patient-1/clinical-summary') {
        return Promise.resolve({
          data: {
            patientId: 'patient-1',
            generatedAt: '2026-03-31T09:00:00.000Z',
            counts: { totalEncounters: 0, activeProblems: 0, pendingTasks: 0 },
            latestEncounterSummary: null,
            vitalTrend: [],
            recentDiagnoses: [],
            activeProblems: [],
            pendingTasks: [],
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    apiPostMock.mockResolvedValue({ data: { id: 'patient-1' } });

    render(<PatientDetailPage />, { wrapper: createWrapper() });

    expect(await screen.findAllByText('Pendiente de verificación médica')).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Validar ficha' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/patients/patient-1/verify-demographics', {});
    });
  });

  it('does not show empty history state when stored history fields contain serialized content', async () => {
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
            registrationMode: 'COMPLETO',
            completenessStatus: 'VERIFICADA',
            demographicsVerifiedAt: '2026-03-31T08:00:00.000Z',
            demographicsVerifiedById: 'user-1',
            demographicsMissingFields: [],
            domicilio: null,
            createdAt: '2026-03-31T08:00:00.000Z',
            updatedAt: '2026-03-31T08:00:00.000Z',
            history: {
              alergias: '{"items":["Penicilina"]}',
            },
            problems: [],
            tasks: [],
          },
        });
      }

      if (url === '/patients/patient-1/encounters?page=1&limit=10') {
        return Promise.resolve({
          data: {
            data: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 0,
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
              totalEncounters: 0,
              activeProblems: 0,
              pendingTasks: 0,
            },
            latestEncounterSummary: null,
            vitalTrend: [],
            recentDiagnoses: [],
            activeProblems: [],
            pendingTasks: [],
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(<PatientDetailPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Penicilina')).toBeInTheDocument();
    expect(screen.queryByText('No hay antecedentes registrados')).not.toBeInTheDocument();
  });
});
