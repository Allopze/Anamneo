import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MutableRefObject, ReactNode } from 'react';
import { useEncounterSectionSaveFlow } from '@/app/(dashboard)/atenciones/[id]/useEncounterSectionSaveFlow';

const apiGetMock = jest.fn();
const apiPutMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    put: (...args: any[]) => apiPutMock(...args),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('@/lib/encounter-draft', () => ({
  clearEncounterSectionConflict: jest.fn(),
  writeEncounterSectionConflict: jest.fn(),
}));

jest.mock('@/lib/offline-queue', () => ({
  isNetworkError: jest.fn(() => false),
}));

jest.mock('@/lib/query-invalidation', () => ({
  invalidateAlertOverviewQueries: jest.fn(),
}));

jest.mock('@/stores/privacy-settings-store', () => ({
  isSharedDeviceModeEnabled: jest.fn(() => false),
  usePrivacySettingsStore: jest.fn(() => ({ hasHydrated: true, sharedDeviceMode: false })),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    error: jest.fn(),
  }),
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

describe('useEncounterSectionSaveFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: {} });
  });

  it('uses the latest server section version for consecutive saves', async () => {
    const initialUpdatedAt = '2026-04-08T12:00:00.000Z';
    const firstSavedAt = '2026-04-08T12:05:00.000Z';
    const secondSavedAt = '2026-04-08T12:06:00.000Z';
    const sectionKey = 'OBSERVACIONES';
    const formDataRef = {
      current: {
        OBSERVACIONES: { notasInternas: 'Primera nota' },
      },
    } as MutableRefObject<Record<string, any>>;
    const lastSavedRef = {
      current: JSON.stringify({
        OBSERVACIONES: { notasInternas: '' },
      }),
    } as MutableRefObject<string>;

    apiPutMock.mockImplementation(async (_url: string, payload: any) => ({
      data: {
        id: 'sec-1',
        encounterId: 'enc-1',
        sectionKey,
        completed: false,
        notApplicable: false,
        notApplicableReason: null,
        updatedAt: apiPutMock.mock.calls.length === 1 ? firstSavedAt : secondSavedAt,
        data: payload.data,
        schemaVersion: 1,
      },
    }));

    const { result } = renderHook(
      () =>
        useEncounterSectionSaveFlow({
          canEdit: true,
          encounter: {
            id: 'enc-1',
            sections: [
              {
                id: 'sec-1',
                sectionKey,
                label: 'Observaciones',
                data: { notasInternas: '' },
                completed: false,
                notApplicable: false,
                notApplicableReason: null,
                updatedAt: initialUpdatedAt,
              },
            ],
          } as any,
          id: 'enc-1',
          isDraftHydrated: true,
          queryClient: new QueryClient(),
          sections: [
            {
              id: 'sec-1',
              sectionKey,
              label: 'Observaciones',
              data: { notasInternas: '' },
              completed: false,
              notApplicable: false,
              notApplicableReason: null,
              updatedAt: initialUpdatedAt,
            },
          ] as any,
          userId: 'med-1',
          enqueueOfflineSave: jest.fn(),
          activeSectionKeyRef: { current: sectionKey } as any,
          formDataRef,
          lastSavedRef,
          setErrorSectionKey: jest.fn(),
          setFormData: jest.fn(),
          setHasUnsavedChanges: jest.fn(),
          setLastSavedAt: jest.fn(),
          setLastSaveOrigin: jest.fn(),
          setRecoverableConflicts: jest.fn(),
          setRecoverableConflict: jest.fn(),
          setSavedSectionKey: jest.fn(),
          setSavedSnapshotJson: jest.fn(),
          setSaveStatus: jest.fn(),
          setSavingSectionKey: jest.fn(),
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.saveSection({
        sectionKey,
        data: formDataRef.current.OBSERVACIONES,
      });
    });

    formDataRef.current.OBSERVACIONES = { notasInternas: 'Primera nota ajustada' };

    await act(async () => {
      await result.current.saveSection({
        sectionKey,
        data: formDataRef.current.OBSERVACIONES,
      });
    });

    expect(apiPutMock).toHaveBeenNthCalledWith(
      1,
      '/encounters/enc-1/sections/OBSERVACIONES',
      expect.objectContaining({ baseUpdatedAt: initialUpdatedAt }),
    );
    expect(apiPutMock).toHaveBeenNthCalledWith(
      2,
      '/encounters/enc-1/sections/OBSERVACIONES',
      expect.objectContaining({ baseUpdatedAt: firstSavedAt }),
    );
  });
});
