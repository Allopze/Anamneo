import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import FichaClinicaPage from '@/app/(dashboard)/atenciones/[id]/ficha/page';
import type { User } from '@/stores/auth-store';

const replaceMock = jest.fn();
const apiGetMock = jest.fn();

const authStoreState: {
  user: User | null;
} = {
  user: {
    id: 'med-1',
    email: 'medico@anamneo.cl',
    nombre: 'Dra. Rivera',
    role: 'MEDICO',
    isAdmin: false,
    medicoId: null,
  },
};

const encounterResponse = {
  id: 'enc-1',
  patientId: 'patient-1',
  createdById: 'med-1',
  status: 'COMPLETADO',
  reviewStatus: 'REVISADA_POR_MEDICO',
  reviewRequestedAt: null,
  reviewNote: null,
  reviewedAt: '2026-04-08T12:30:00.000Z',
  completedAt: '2026-04-08T12:45:00.000Z',
  closureNote: 'Paciente estable al alta.',
  createdAt: '2026-04-08T12:00:00.000Z',
  updatedAt: '2026-04-08T12:45:00.000Z',
  patient: {
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
    registrationMode: 'RAPIDO',
    completenessStatus: 'PENDIENTE_VERIFICACION',
    demographicsMissingFields: [],
    createdAt: '2026-04-08T12:00:00.000Z',
    updatedAt: '2026-04-08T12:00:00.000Z',
  },
  createdBy: {
    id: 'med-1',
    nombre: 'Dra. Rivera',
  },
  attachments: [],
  clinicalOutputBlock: {
    completenessStatus: 'PENDIENTE_VERIFICACION',
    missingFields: [],
    blockedActions: ['COMPLETE_ENCOUNTER', 'EXPORT_OFFICIAL_DOCUMENTS', 'PRINT_CLINICAL_RECORD'],
    reason: 'La ficha maestra del paciente está pendiente de verificación médica antes de habilitar cierres y documentos clínicos oficiales.',
  },
  sections: [
    {
      id: 'sec-identificacion',
      encounterId: 'enc-1',
      sectionKey: 'IDENTIFICACION',
      schemaVersion: 1,
      label: 'Identificación',
      order: 0,
      data: {
        nombre: 'Paciente Demo',
        rut: '11.111.111-1',
        edad: 44,
        sexo: 'FEMENINO',
        prevision: 'FONASA',
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
    {
      id: 'sec-motivo',
      encounterId: 'enc-1',
      sectionKey: 'MOTIVO_CONSULTA',
      schemaVersion: 1,
      label: 'Motivo de Consulta',
      order: 1,
      data: {
        texto: 'Consulta por cefalea persistente.',
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
    {
      id: 'sec-tratamiento',
      encounterId: 'enc-1',
      sectionKey: 'TRATAMIENTO',
      schemaVersion: 1,
      label: 'Tratamiento',
      order: 7,
      data: {
        plan: 'Reposo e hidratación',
        receta: 'Paracetamol 1 g cada 8 horas',
      },
      completed: true,
      updatedAt: '2026-04-08T12:00:00.000Z',
    },
  ],
};

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'enc-1' }),
  useRouter: () => ({ replace: replaceMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => authStoreState,
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
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

describe('FichaClinicaPage clinical-output block', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/encounters/enc-1') {
        return Promise.resolve({ data: encounterResponse });
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('disables print and official export actions when the patient record is pending verification', async () => {
    render(<FichaClinicaPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: /ficha clínica/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Órdenes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Derivación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled();
    expect(screen.getByText('Salidas clinicas bloqueadas')).toBeInTheDocument();
    expect(screen.getByText('Impresión bloqueada')).toBeInTheDocument();
    expect(screen.getAllByText(/pendiente de verificación médica/i)).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Revisar ficha administrativa' })).toHaveAttribute('href', '/pacientes/patient-1');
  });

  it('disables official outputs when the encounter is not yet completed even if the patient is verified', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/encounters/enc-1') {
        return Promise.resolve({
          data: {
            ...encounterResponse,
            status: 'EN_PROGRESO',
            clinicalOutputBlock: null,
            patient: {
              ...encounterResponse.patient,
              registrationMode: 'COMPLETO',
              completenessStatus: 'VERIFICADA',
              demographicsMissingFields: [],
            },
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(<FichaClinicaPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: /ficha clínica/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Receta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Órdenes' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Derivación' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeDisabled();
    expect(screen.getAllByText(/completada o firmada/i)).toHaveLength(2);
  });
});
