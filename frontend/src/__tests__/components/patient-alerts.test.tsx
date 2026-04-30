import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PatientAlerts from '@/components/PatientAlerts';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: jest.fn(),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector?: (state: any) => unknown) => {
      const state = { user: { id: 'doctor-1', role: 'MEDICO' } };
      return selector ? selector(state) : state;
    }),
    {
      persist: { clearStorage: jest.fn() },
      setState: jest.fn(),
    },
  ),
  useAuthUser: () => ({ id: 'doctor-1', role: 'MEDICO' }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
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

function acknowledgedAlert(index: number) {
  return {
    id: `ack-${index}`,
    type: 'GENERAL',
    severity: 'BAJA',
    title: `Alerta ${index}`,
    message: 'Reconocida',
    acknowledgedAt: '2026-04-19T10:00:00.000Z',
    acknowledgedBy: { nombre: 'Dra. Rivera' },
    createdAt: '2026-04-18T10:00:00.000Z',
  };
}

describe('PatientAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads more acknowledged alerts in increments', async () => {
    apiGetMock
      .mockResolvedValueOnce({
        data: {
          data: Array.from({ length: 20 }, (_, index) => acknowledgedAlert(index + 1)),
          meta: { acknowledgedHasMore: true },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: Array.from({ length: 40 }, (_, index) => acknowledgedAlert(index + 1)),
          meta: { acknowledgedHasMore: false },
        },
      });

    render(<PatientAlerts patientId="patient-1" />, { wrapper: createWrapper() });

    const button = await screen.findByRole('button', { name: 'Ver más alertas reconocidas' });
    expect(apiGetMock).toHaveBeenCalledWith(
      '/alerts/patient/patient-1?includeAcknowledged=true&acknowledgedLimit=20&withMeta=true',
    );

    await userEvent.click(button);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/alerts/patient/patient-1?includeAcknowledged=true&acknowledgedLimit=40&withMeta=true',
      );
    });
  });
});
