import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import ClinicalAlerts from '@/components/ClinicalAlerts';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
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

describe('ClinicalAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockImplementation((url: string) => {
      if (url === '/patients/patient-1') {
        return Promise.resolve({
          data: {
            id: 'patient-1',
            history: {
              alergias: JSON.stringify({ items: ['Penicilina'] }),
              medicamentos: null,
              antecedentesMedicos: null,
            },
            problems: [],
            tasks: [],
          },
        });
      }

      if (url === '/patients/patient-1/clinical-summary') {
        return Promise.resolve({
          data: {
            patientId: 'patient-1',
            generatedAt: '2026-04-19T10:00:00.000Z',
            counts: { totalEncounters: 3, activeProblems: 0, pendingTasks: 0 },
            latestEncounterSummary: null,
            vitalTrend: [
              {
                encounterId: 'enc-1',
                createdAt: '2026-04-19T09:30:00.000Z',
                presionArterial: '170/100',
                peso: null,
                imc: null,
                temperatura: 38.2,
                saturacionOxigeno: 91,
              },
            ],
            recentDiagnoses: [],
            activeProblems: [],
            pendingTasks: [],
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('builds contextual alerts from clinical summary vitals instead of the patient timeline', async () => {
    render(<ClinicalAlerts patientId="patient-1" />, { wrapper: createWrapper() });

    expect(await screen.findByText('Hipertensión')).toBeInTheDocument();
    expect(screen.getByText('Presión arterial elevada: 170/100')).toBeInTheDocument();
    expect(screen.getByText('Fiebre')).toBeInTheDocument();
    expect(screen.getByText('Temperatura elevada: 38.2°C')).toBeInTheDocument();
    expect(screen.getByText('Hipoxemia')).toBeInTheDocument();
    expect(screen.getByText('Saturación de oxígeno baja: 91%')).toBeInTheDocument();
  });
});
