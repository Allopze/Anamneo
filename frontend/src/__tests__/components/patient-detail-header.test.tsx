import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import PatientDetailHeader from '@/app/(dashboard)/pacientes/[id]/PatientDetailHeader';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (e: any) => e?.message ?? 'Error',
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/pacientes/patient-1',
}));

jest.mock('@/components/common/InProgressEncounterConflictModal', () => ({
  InProgressEncounterConflictModal: () => null,
}));
jest.mock('@/components/common/PossiblePatientDuplicatesNotice', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/ReassignmentCard', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/app/(dashboard)/pacientes/[id]/PatientLongitudinalSummaryCard', () => ({
  __esModule: true,
  default: () => null,
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const PATIENT_BASE = {
  id: 'patient-1',
  nombre: 'Ana Soto',
  rut: '12.345.678-5',
  edad: 42,
  edadMeses: null,
  sexo: 'FEMENINO',
  prevision: 'FONASA',
  completenessStatus: 'VERIFICADA',
  rutExempt: false,
  rutExemptReason: null,
  fechaNacimiento: '1982-06-15',
  history: null,
  problems: [],
  tasks: [],
  domicilio: null,
  telefono: null,
  email: null,
  contactoEmergenciaNombre: null,
  contactoEmergenciaTelefono: null,
  centroMedico: null,
  trabajo: null,
  archivedAt: null,
  blockedAt: null,
  blockedReason: null,
  blockedById: null,
  legalStatus: null,
} as any;

const PD_BASE = {
  id: 'patient-1',
  isDoctor: true,
  isAdmin: false,
  canEditAdminFields: false,
  canEditAntecedentes: false,
  canCreateEncounterAllowed: false,
  canReassignPatientAllowed: false,
  conflictEncounters: null,
  completenessMeta: null,
  clinicalSummary: undefined,
  router: { push: jest.fn() },
  historyHasContent: false,
  exportingPdf: false,
  exportingBundle: false,
  handleExportHistorial: jest.fn(),
  handleExportBundle: jest.fn(),
  handleDelete: jest.fn(),
  deleteMutation: { mutate: jest.fn(), isPending: false } as any,
  createEncounterMutation: { mutate: jest.fn(), isPending: false } as any,
  verifyDemographicsMutation: { mutate: jest.fn(), isPending: false } as any,
  mergePatientMutation: { isPending: false } as any,
  mergeCandidate: null,
  setMergeCandidate: jest.fn(),
  setConflictEncounters: jest.fn(),
  handleReassignmentSuccess: jest.fn(),
  editingProblemId: null,
  setEditingProblemId: jest.fn(),
  problemForm: {} as any,
  createProblemMutation: { mutate: jest.fn(), isPending: false } as any,
  updateProblemMutation: { mutate: jest.fn(), isPending: false } as any,
  editingTaskId: null,
  setEditingTaskId: jest.fn(),
  taskForm: {} as any,
  createTaskMutation: { mutate: jest.fn(), isPending: false } as any,
  updateTaskMutation: { mutate: jest.fn(), isPending: false } as any,
  vitalTrend: [],
  showFullVitals: false,
  setShowFullVitals: jest.fn(),
  selectedVitalKey: 'peso' as any,
  setSelectedVitalKey: jest.fn(),
} as any;

describe('PatientDetailHeader — critical allergy badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows no badge when there are no allergies', async () => {
    apiGetMock.mockResolvedValue({ data: [] });

    render(<PatientDetailHeader patient={PATIENT_BASE} pd={PD_BASE} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(screen.queryByText(/alergia/i, { selector: 'span' })).toBeNull();
  });

  it('shows no badge when all allergies are LEVE or MODERADA', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        { id: 'a1', allergen: 'Polen', severity: 'LEVE', deletedAt: null },
        { id: 'a2', allergen: 'Polvo', severity: 'MODERADA', deletedAt: null },
      ],
    });

    render(<PatientDetailHeader patient={PATIENT_BASE} pd={PD_BASE} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(screen.queryByText(/alergia/i, { selector: 'span' })).toBeNull();
  });

  it('shows a badge for a single GRAVE allergy with the allergen name', async () => {
    apiGetMock.mockResolvedValue({
      data: [{ id: 'a1', allergen: 'Penicilina', severity: 'GRAVE', deletedAt: null }],
    });

    render(<PatientDetailHeader patient={PATIENT_BASE} pd={PD_BASE} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(screen.getByText(/alergia grave: penicilina/i)).toBeInTheDocument(),
    );
  });

  it('shows a badge for a FATAL allergy with the allergen name', async () => {
    apiGetMock.mockResolvedValue({
      data: [{ id: 'a1', allergen: 'Aspirina', severity: 'FATAL', deletedAt: null }],
    });

    render(<PatientDetailHeader patient={PATIENT_BASE} pd={PD_BASE} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(screen.getByText(/alergia grave: aspirina/i)).toBeInTheDocument(),
    );
  });

  it('shows a count badge for multiple GRAVE/FATAL allergies', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        { id: 'a1', allergen: 'Penicilina', severity: 'GRAVE', deletedAt: null },
        { id: 'a2', allergen: 'Ibuprofeno', severity: 'FATAL', deletedAt: null },
      ],
    });

    render(<PatientDetailHeader patient={PATIENT_BASE} pd={PD_BASE} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() =>
      expect(screen.getByText(/alergias graves \(2\)/i)).toBeInTheDocument(),
    );
  });

  it('ignores soft-deleted allergies when computing the badge', async () => {
    apiGetMock.mockResolvedValue({
      data: [
        { id: 'a1', allergen: 'Penicilina', severity: 'GRAVE', deletedAt: '2026-01-01T00:00:00Z' },
        { id: 'a2', allergen: 'Polen', severity: 'LEVE', deletedAt: null },
      ],
    });

    render(<PatientDetailHeader patient={PATIENT_BASE} pd={PD_BASE} />, {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    expect(screen.queryByText(/alergia/i, { selector: 'span' })).toBeNull();
  });

  it('fetches using the same query key as PatientAllergiesList', () => {
    apiGetMock.mockResolvedValue({ data: [] });

    render(<PatientDetailHeader patient={PATIENT_BASE} pd={PD_BASE} />, {
      wrapper: makeWrapper(),
    });

    expect(apiGetMock).toHaveBeenCalledWith('/allergies/patient/patient-1');
  });
});
