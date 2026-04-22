import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClinicalAnalyticsPage from '@/app/(dashboard)/analitica-clinica/page';

const apiGetMock = jest.fn();
const pushMock = jest.fn();
const toastSuccessMock = jest.fn();
const toastErrorMock = jest.fn();
let mockUser: {
  id: string;
  nombre: string;
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
  isAdmin?: boolean;
} | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams('fromDate=2026-01-01&toDate=2026-04-20&followUpDays=30&limit=10&source=ANY'),
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
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
  },
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

describe('ClinicalAnalyticsPage', () => {
  const createObjectUrlSpy = jest.fn(() => 'blob:summary-csv');
  const createObjectUrlMarkdownSpy = jest.fn(() => 'blob:summary-md');
  const revokeObjectUrlSpy = jest.fn();
  const clickSpy = jest.fn();

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
          condition: null,
          source: 'ANY',
          fromDate: '2026-01-01',
          toDate: '2026-04-20',
          followUpDays: 30,
          limit: 10,
        },
        caveats: ['Los resultados son descriptivos y observacionales; no prueban efectividad comparativa ni causalidad.'],
        summary: {
          matchedPatients: 12,
          matchedEncounters: 18,
          structuredTreatmentCount: 14,
          structuredTreatmentCoverage: 14 / 18,
          reconsultWithinWindowCount: 7,
          reconsultWithinWindowRate: 0.4,
          treatmentAdjustmentCount: 4,
          treatmentAdjustmentRate: 0.2,
          resolvedProblemCount: 3,
          resolvedProblemRate: 0.15,
          alertAfterIndexCount: 2,
          alertAfterIndexRate: 0.1,
          demographics: {
            averageAge: 51,
            bySex: { F: 8, M: 4 },
          },
        },
        topConditions: [{ label: 'Hipertensión arterial', encounterCount: 10, patientCount: 7, badge: 'Afección probable' }],
        cohortBreakdown: {
          associatedSymptoms: [
            { label: 'Vómitos', encounterCount: 6, patientCount: 6 },
            { label: 'Diarrea', encounterCount: 4, patientCount: 4 },
          ],
          foodRelation: [
            { label: 'Asociado a comida', encounterCount: 5, patientCount: 5 },
            { label: 'No asociado a comida', encounterCount: 2, patientCount: 2 },
            { label: 'Sin dato claro', encounterCount: 11, patientCount: 8 },
          ],
        },
        treatmentPatterns: {
          medications: [{ label: 'Enalapril', encounterCount: 6, patientCount: 5 }],
          exams: [{ label: 'Perfil lipídico', encounterCount: 4, patientCount: 4 }],
          referrals: [],
        },
        treatmentOutcomeProxies: {
          medications: [
            {
              label: 'Tratamiento A',
              patientCount: 4,
              encounterCount: 4,
              favorableCount: 2,
              favorableRate: 0.5,
              adjustmentCount: 1,
              reconsultCount: 1,
            },
            {
              label: 'Tratamiento B',
              patientCount: 3,
              encounterCount: 3,
              favorableCount: 1,
              favorableRate: 0.33,
              adjustmentCount: 1,
              reconsultCount: 2,
            },
          ],
          exams: [
            {
              label: 'Perfil lipídico',
              patientCount: 2,
              encounterCount: 2,
              favorableCount: 1,
              favorableRate: 0.5,
              adjustmentCount: 0,
              reconsultCount: 1,
            },
          ],
          referrals: [],
        },
      },
    });

    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectUrlSpy,
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders cards, caveats and ranked clinical tables', async () => {
    render(<ClinicalAnalyticsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Analítica clínica')).toBeInTheDocument();
    expect(await screen.findByText('Cobertura estructurada')).toBeInTheDocument();
    expect(await screen.findByText('14 de 18 atenciones con medicamentos, exámenes o derivaciones estructuradas')).toBeInTheDocument();
    expect(await screen.findByText('Cohortes principales')).toBeInTheDocument();
    expect(await screen.findByText('Hipertensión arterial')).toBeInTheDocument();
    expect(await screen.findByText('Enalapril')).toBeInTheDocument();
    expect(await screen.findByText('Síntomas asociados')).toBeInTheDocument();
    expect(await screen.findByText('Vómitos')).toBeInTheDocument();
    expect(await screen.findByText('Relación con comida')).toBeInTheDocument();
    expect(await screen.findByText('Asociado a comida')).toBeInTheDocument();
    expect(await screen.findByText('Medicamentos con respuesta favorable proxy')).toBeInTheDocument();
    expect(await screen.findByText('Exámenes con respuesta favorable proxy')).toBeInTheDocument();
    expect(await screen.findByText('Tratamiento A')).toBeInTheDocument();
    expect((await screen.findAllByText('Perfil lipídico')).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/no prueban efectividad comparativa/i)).toBeInTheDocument();
  });

  it('keeps draft filters local until the user applies them', async () => {
    render(<ClinicalAnalyticsPage />, { wrapper: createWrapper() });

    await screen.findByText('Analítica clínica');
    expect(apiGetMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText('Afección, síntoma o CIE10'), {
      target: { value: 'dolor abdominal' },
    });

    expect(apiGetMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar vista' }));

    expect(pushMock).toHaveBeenCalledWith('/analitica-clinica?condition=dolor+abdominal&source=ANY&fromDate=2026-01-01&toDate=2026-04-20&followUpDays=30&limit=10');
  });

  it('downloads the current summary as CSV', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        filters: {
          condition: null,
          source: 'ANY',
          fromDate: '2026-01-01',
          toDate: '2026-04-20',
          followUpDays: 30,
          limit: 10,
        },
        caveats: ['Los resultados son descriptivos y observacionales; no prueban efectividad comparativa ni causalidad.'],
        summary: {
          matchedPatients: 12,
          matchedEncounters: 18,
          structuredTreatmentCount: 14,
          structuredTreatmentCoverage: 14 / 18,
          reconsultWithinWindowCount: 7,
          reconsultWithinWindowRate: 0.4,
          treatmentAdjustmentCount: 4,
          treatmentAdjustmentRate: 0.2,
          resolvedProblemCount: 3,
          resolvedProblemRate: 0.15,
          alertAfterIndexCount: 2,
          alertAfterIndexRate: 0.1,
          adherenceDocumentedCount: 8,
          adherenceDocumentedRate: 0.44,
          adverseEventCount: 1,
          adverseEventRate: 0.05,
          demographics: {
            averageAge: 51,
            bySex: { F: 8, M: 4 },
          },
        },
        topConditions: [{ label: 'Hipertensión arterial', encounterCount: 10, patientCount: 7, badge: 'Afección probable' }],
        cohortBreakdown: {
          associatedSymptoms: [],
          foodRelation: [],
        },
        treatmentPatterns: {
          medications: [],
          exams: [],
          referrals: [],
        },
        treatmentOutcomeProxies: {
          medications: [],
          exams: [],
          referrals: [],
        },
      },
    });
    apiGetMock.mockResolvedValueOnce({
      data: new Blob(['csv']),
      headers: {
        'content-disposition': 'attachment; filename="resumen_analitica_clinica_2026-04-22.csv"',
      },
    });

    render(<ClinicalAnalyticsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Analítica clínica')).toBeInTheDocument();
    expect(await screen.findByText('Hipertensión arterial')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar resumen CSV' }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/analytics/clinical/summary/export/csv?source=ANY&fromDate=2026-01-01&toDate=2026-04-20&followUpDays=30&limit=10',
        { responseType: 'blob' },
      );
    });

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:summary-csv');
    expect(toastSuccessMock).toHaveBeenCalledWith('CSV descargado');
  });

  it('downloads the current summary as a Markdown report', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        filters: {
          condition: null,
          source: 'ANY',
          fromDate: '2026-01-01',
          toDate: '2026-04-20',
          followUpDays: 30,
          limit: 10,
        },
        caveats: ['Los resultados son descriptivos y observacionales; no prueban efectividad comparativa ni causalidad.'],
        summary: {
          matchedPatients: 12,
          matchedEncounters: 18,
          structuredTreatmentCount: 14,
          structuredTreatmentCoverage: 14 / 18,
          reconsultWithinWindowCount: 7,
          reconsultWithinWindowRate: 0.4,
          treatmentAdjustmentCount: 4,
          treatmentAdjustmentRate: 0.2,
          resolvedProblemCount: 3,
          resolvedProblemRate: 0.15,
          alertAfterIndexCount: 2,
          alertAfterIndexRate: 0.1,
          adherenceDocumentedCount: 8,
          adherenceDocumentedRate: 0.44,
          adverseEventCount: 1,
          adverseEventRate: 0.05,
          demographics: {
            averageAge: 51,
            bySex: { F: 8, M: 4 },
          },
        },
        topConditions: [{ label: 'Hipertensión arterial', encounterCount: 10, patientCount: 7, badge: 'Afección probable' }],
        cohortBreakdown: {
          associatedSymptoms: [],
          foodRelation: [],
        },
        treatmentPatterns: {
          medications: [],
          exams: [],
          referrals: [],
        },
        treatmentOutcomeProxies: {
          medications: [],
          exams: [],
          referrals: [],
        },
      },
    });
    apiGetMock.mockResolvedValueOnce({
      data: new Blob(['# reporte']),
      headers: {
        'content-disposition': 'attachment; filename="reporte_analitica_clinica_2026-04-22.md"',
      },
    });

    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: createObjectUrlMarkdownSpy,
    });

    render(<ClinicalAnalyticsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Analítica clínica')).toBeInTheDocument();
    expect(await screen.findByText('Hipertensión arterial')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Descargar reporte' }));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/analytics/clinical/summary/export/md?source=ANY&fromDate=2026-01-01&toDate=2026-04-20&followUpDays=30&limit=10',
        { responseType: 'blob' },
      );
    });

    expect(createObjectUrlMarkdownSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:summary-md');
    expect(toastSuccessMock).toHaveBeenCalledWith('Reporte descargado');
  });

  it('redirects assistants away without querying analytics data', async () => {
    mockUser = {
      id: 'assistant-1',
      nombre: 'Asistente Demo',
      role: 'ASISTENTE',
      isAdmin: false,
    };

    render(<ClinicalAnalyticsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith('/');
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('redirects MEDICO users flagged as admin away without querying analytics data', async () => {
    mockUser = {
      id: 'med-admin-1',
      nombre: 'Medico Admin',
      role: 'MEDICO',
      isAdmin: true,
    };

    render(<ClinicalAnalyticsPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Acceso restringido')).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith('/');
    expect(apiGetMock).not.toHaveBeenCalled();
  });
});