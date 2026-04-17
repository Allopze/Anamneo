import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useEncounterWorkflowActions } from '@/app/(dashboard)/atenciones/[id]/useEncounterWorkflowActions';

const apiPostMock = jest.fn();
const apiPutMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: any[]) => apiPostMock(...args),
    put: (...args: any[]) => apiPutMock(...args),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('@/lib/encounter-draft', () => ({
  clearEncounterDraft: jest.fn(),
}));

jest.mock('@/lib/clinical-output', () => ({
  getEncounterClinicalOutputBlockReason: jest.fn(() => null),
}));

jest.mock('@/lib/query-invalidation', () => ({
  invalidateDashboardOverviewQueries: jest.fn().mockResolvedValue(undefined),
  invalidateTaskOverviewQueries: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    success: jest.fn(),
    error: jest.fn(),
  }),
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEncounterWorkflowActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiPostMock.mockResolvedValue({ data: {} });
    apiPutMock.mockResolvedValue({ data: {} });
  });

  it('requires saving the active section before marking an encounter as reviewed', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const ensureActiveSectionSaved = jest.fn().mockResolvedValue(true);

    const { result } = renderHook(
      () =>
        useEncounterWorkflowActions({
          canEdit: true,
          canCreateFollowupTask: false,
          canRequestMedicalReview: false,
          canMarkReviewedByDoctor: true,
          encounter: {
            id: 'enc-1',
            patientId: 'patient-1',
            status: 'EN_PROGRESO',
            reviewStatus: 'NO_REQUIERE_REVISION',
          } as any,
          ensureActiveSectionSaved,
          id: 'enc-1',
          navigate: jest.fn(),
          queryClient,
          userId: 'med-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.setReviewActionNote('  Revisión clínica completa antes del cierre.  ');
    });

    await act(async () => {
      await result.current.handleReviewStatusChange('REVISADA_POR_MEDICO');
    });

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/encounters/enc-1/review-status', {
        reviewStatus: 'REVISADA_POR_MEDICO',
        note: 'Revisión clínica completa antes del cierre.',
      });
    });

    expect(ensureActiveSectionSaved).toHaveBeenCalledTimes(1);
    expect(ensureActiveSectionSaved.mock.invocationCallOrder[0]).toBeLessThan(apiPutMock.mock.invocationCallOrder[0]);
  });

  it('blocks review status updates when the review note is still too short', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const ensureActiveSectionSaved = jest.fn().mockResolvedValue(true);

    const { result } = renderHook(
      () =>
        useEncounterWorkflowActions({
          canEdit: true,
          canCreateFollowupTask: false,
          canRequestMedicalReview: false,
          canMarkReviewedByDoctor: true,
          encounter: {
            id: 'enc-1',
            patientId: 'patient-1',
            status: 'EN_PROGRESO',
            reviewStatus: 'NO_REQUIERE_REVISION',
          } as any,
          ensureActiveSectionSaved,
          id: 'enc-1',
          navigate: jest.fn(),
          queryClient,
          userId: 'med-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.setReviewActionNote('corta');
    });

    await act(async () => {
      await result.current.handleReviewStatusChange('REVISADA_POR_MEDICO');
    });

    expect(ensureActiveSectionSaved).not.toHaveBeenCalled();
    expect(apiPutMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('La nota de revisión debe tener al menos 10 caracteres');
  });
});