import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditarPacientePage from '@/app/(dashboard)/pacientes/[id]/editar/page';

const pushMock = jest.fn();
const apiGetMock = jest.fn();
const apiPutMock = jest.fn();
const authStoreState: any = {
  user: {
    id: 'med-1',
    email: 'medico@anamneo.cl',
    nombre: 'Dra. Rivera',
    role: 'MEDICO' as const,
    isAdmin: false,
    medicoId: null,
  },
  isMedico: () => true,
  canEditPatientAdmin: () => true,
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
    put: (...args: any[]) => apiPutMock(...args),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/query-invalidation', () => ({
  invalidateDashboardOverviewQueries: jest.fn().mockResolvedValue(undefined),
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

describe('EditarPacientePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authStoreState.user = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Dra. Rivera',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
    };
    authStoreState.isMedico = () => true;
    authStoreState.canEditPatientAdmin = () => true;
    apiPutMock.mockResolvedValue({ data: {} });
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/patients/patient-1') {
        return Promise.resolve({
          data: {
            id: 'patient-1',
            nombre: 'Paciente Demo',
            rut: '12.345.678-5',
            rutExempt: false,
            rutExemptReason: null,
            fechaNacimiento: '2020-05-15T00:00:00.000Z',
            sexo: 'FEMENINO',
            prevision: 'FONASA',
            trabajo: 'Docente',
            domicilio: 'Santiago',
            centroMedico: 'Centro Base',
            completenessStatus: 'VERIFICADA',
          },
        });
      }

      if (url === '/patients/possible-duplicates') {
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'patient-2',
                nombre: 'Paciente Demo',
                rut: '12.345.678-5',
                fechaNacimiento: '2020-05-15',
                registrationMode: 'COMPLETO',
                completenessStatus: 'VERIFICADA',
                matchReasons: ['same_rut', 'same_name_birth_date'],
              },
            ],
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('checks duplicates excluding the current patient id', async () => {
    render(<EditarPacientePage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Posibles pacientes duplicados')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/patients/possible-duplicates', {
        params: expect.objectContaining({
          nombre: 'Paciente Demo',
          fechaNacimiento: '2020-05-15',
          rut: '12.345.678-5',
          excludePatientId: 'patient-1',
        }),
      });
    });
  });

  it('submits centroMedico together with the editable demographic payload', async () => {
    const user = userEvent.setup();
    render(<EditarPacientePage />, { wrapper: createWrapper() });

    expect(await screen.findByDisplayValue('Centro Base')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Centro médico'));
    await user.type(screen.getByLabelText('Centro médico'), 'Centro Norte');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith(
        '/patients/patient-1',
        expect.objectContaining({
          centroMedico: 'Centro Norte',
        }),
      );
    });
  });

  it('does not fetch the patient when the user will be redirected for lack of permissions', async () => {
    authStoreState.user = {
      id: 'assistant-1',
      email: 'asistente@anamneo.cl',
      nombre: 'Asistente Demo',
      role: 'ASISTENTE',
      isAdmin: false,
      medicoId: 'med-1',
    };
    authStoreState.isMedico = () => false;
    authStoreState.canEditPatientAdmin = () => false;

    render(<EditarPacientePage />, { wrapper: createWrapper() });

    expect(screen.getByText('Redirigiendo…')).toBeInTheDocument();
    expect(screen.getByText(/No tienes permisos para editar esta ficha/i)).toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});
