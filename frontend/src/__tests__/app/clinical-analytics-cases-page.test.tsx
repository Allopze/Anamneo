import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import ClinicalAnalyticsCasesPage from '@/app/(dashboard)/analitica-clinica/casos/page';

const apiGetMock = jest.fn();
const pushMock = jest.fn();

let mockUser: {
  id: string;
  nombre: string;
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
  isAdmin?: boolean;
} | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () => new URLSearchParams('condition=dolor+abdominal&source=ANY&fromDate=2026-01-01&toDate=2026-04-20&followUpDays=30&focusType=MEDICATION&focusValue=Paracetamol&page=1'),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: mockUser,
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

describe('ClinicalAnalyticsCasesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'med-1',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
    };
    apiGetMock.mockResolvedValue({
      data: {
        filters: {
          condition: 'dolor abdominal',
          source: 'ANY',
          fromDate: '2026-01-01',
          toDate: '2026-04-20',
          followUpDays: 30,
        },
        focus: {
          type: 'MEDICATION',
          value: 'Paracetamol',
        },
        pagination: {
          page: 1,
          pageSize: 15,
          total: 1,
          totalPages: 1,
        },
        data: [
          {
            encounterId: 'enc-1',
            patientId: 'pat-1',
            patientName: 'Paciente Demo',
            patientRut: '12.345.678-5',
            createdAt: '2026-04-10T15:30:00.000Z',
            status: 'COMPLETADO',
            patientAge: 42,
            patientSex: 'FEMENINO',
            patientPrevision: 'FONASA',
            conditions: ['Dolor abdominal funcional'],
            medications: ['Paracetamol'],
            symptoms: ['Dolor abdominal', 'Náuseas'],
            foodRelation: 'Asociado a comida',
            hasTreatmentAdjustment: false,
            hasFavorableResponse: true,
          },
        ],
      },
    });
  });

  it('renders the drill-down cases table and detail links', async () => {
    render(<ClinicalAnalyticsCasesPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Casos analíticos')).toBeInTheDocument();
    expect(
      await screen.findByText('Casos de la cohorte actual donde se indicó Paracetamol.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Paciente Demo')).toBeInTheDocument();
    expect((await screen.findAllByText('Paracetamol')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('link', { name: 'Ver atención' })).toHaveAttribute('href', '/atenciones/enc-1');
    expect(await screen.findByRole('link', { name: 'Ver paciente' })).toHaveAttribute('href', '/pacientes/pat-1');
  });

  it('redirects assistants away without querying cases data', async () => {
    mockUser = {
      id: 'assistant-1',
      nombre: 'Asistente Demo',
      role: 'ASISTENTE',
      isAdmin: false,
    };

    render(<ClinicalAnalyticsCasesPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith('/');
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});