import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import PatientAdministrativeDetailPage from '@/app/(dashboard)/pacientes/[id]/administrativo/page';
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
  useParams: () => ({ id: 'patient-1' }),
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({ user: currentUser }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (err: any) => err?.message || 'Error desconocido',
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

describe('PatientAdministrativeDetailPage', () => {
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

    apiGetMock.mockResolvedValue({
      data: {
        id: 'patient-1',
        rut: '11.111.111-1',
        rutExempt: false,
        rutExemptReason: null,
        nombre: 'Paciente Demo',
        edad: 44,
        sexo: 'FEMENINO',
        trabajo: 'Contadora',
        prevision: 'FONASA',
        registrationMode: 'RAPIDO',
        completenessStatus: 'PENDIENTE_VERIFICACION',
        demographicsVerifiedAt: null,
        demographicsVerifiedById: null,
        demographicsMissingFields: [],
        domicilio: 'Santiago',
        createdAt: '2026-03-31T08:00:00.000Z',
        updatedAt: '2026-04-01T10:00:00.000Z',
        createdBy: {
          id: 'med-1',
          nombre: 'Dra. Rivera',
          email: 'medico@anamneo.cl',
        },
        metrics: {
          encounterCount: 3,
          lastEncounterAt: '2026-04-02T09:30:00.000Z',
        },
      },
    });
  });

  it('renders the administrative patient summary for admin users', async () => {
    render(<PatientAdministrativeDetailPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();
    expect(screen.getByText('Ficha administrativa')).toBeInTheDocument();
    expect(screen.getByText('Atenciones registradas')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getAllByText('Pendiente de verificación médica')).toHaveLength(2);
    expect(apiGetMock).toHaveBeenCalledWith('/patients/patient-1/admin-summary');
  });

  it('redirects non-admin users to the clinical detail route', async () => {
    currentUser = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
    };

    render(<PatientAdministrativeDetailPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/pacientes/patient-1');
    });

    expect(apiGetMock).not.toHaveBeenCalled();
  });
});