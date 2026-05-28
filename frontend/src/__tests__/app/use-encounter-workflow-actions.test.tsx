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

import type { FollowupSuggestion } from '@/lib/diagnosis-followup-map';

const getSuggestedFollowupMock = jest.fn<FollowupSuggestion | null, [unknown]>(() => null);
jest.mock('@/lib/diagnosis-followup-map', () => ({
  getSuggestedFollowup: (arg: unknown) => getSuggestedFollowupMock(arg),
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

  it('handleComplete aborts without saving when active section save fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const ensureActiveSectionSaved = jest.fn().mockResolvedValue(false);

    const { result } = renderHook(
      () =>
        useEncounterWorkflowActions({
          canEdit: true,
          canCreateFollowupTask: false,
          canRequestMedicalReview: false,
          canMarkReviewedByDoctor: false,
          encounter: { id: 'enc-1', patientId: 'p-1', status: 'EN_PROGRESO', sections: [] } as any,
          ensureActiveSectionSaved,
          id: 'enc-1',
          navigate: jest.fn(),
          queryClient,
          userId: 'med-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.setClosureNote('Nota de cierre válida para completar la atención');
    });

    await act(async () => {
      await result.current.handleComplete();
    });

    expect(ensureActiveSectionSaved).toHaveBeenCalledTimes(1);
    expect(result.current.showCompleteConfirm).toBe(false);
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it('handleComplete shows confirmation dialog when all checks pass', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const ensureActiveSectionSaved = jest.fn().mockResolvedValue(true);

    const { result } = renderHook(
      () =>
        useEncounterWorkflowActions({
          canEdit: true,
          canCreateFollowupTask: false,
          canRequestMedicalReview: false,
          canMarkReviewedByDoctor: false,
          encounter: { id: 'enc-1', patientId: 'p-1', status: 'EN_PROGRESO', sections: [] } as any,
          ensureActiveSectionSaved,
          id: 'enc-1',
          navigate: jest.fn(),
          queryClient,
          userId: 'med-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.setClosureNote('Nota de cierre válida para completar la atención');
    });

    await act(async () => {
      await result.current.handleComplete();
    });

    expect(ensureActiveSectionSaved).toHaveBeenCalledTimes(1);
    expect(result.current.showCompleteConfirm).toBe(true);
  });

  it('handleFollowupSkip navigates using pendingNavRef and clears the suggestion', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const navigateMock = jest.fn();
    getSuggestedFollowupMock.mockReturnValue({
      days: 30,
      diagnosisText: 'Hipertensión',
      suggestedDate: '2026-06-10',
    });

    const { result } = renderHook(
      () =>
        useEncounterWorkflowActions({
          canEdit: true,
          canCreateFollowupTask: false,
          canRequestMedicalReview: false,
          canMarkReviewedByDoctor: false,
          encounter: { id: 'enc-1', patientId: 'p-1', status: 'EN_PROGRESO', sections: [] } as any,
          ensureActiveSectionSaved: jest.fn().mockResolvedValue(true),
          id: 'enc-1',
          navigate: navigateMock,
          queryClient,
          userId: 'med-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.setClosureNote('Nota de cierre válida para completar la atención');
    });

    await act(async () => {
      await result.current.handleComplete();
    });

    act(() => result.current.confirmComplete());

    await waitFor(() => {
      expect(result.current.followupSuggestion).not.toBeNull();
    });

    act(() => {
      result.current.handleFollowupSkip();
    });

    expect(result.current.followupSuggestion).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith('/atenciones/enc-1/ficha');
  });
});