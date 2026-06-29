import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingPanel from '@/components/onboarding/OnboardingPanel';

const apiGetMock = jest.fn();
const apiPatchMock = jest.fn();

let mockUser: {
  id: string;
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
  isAdmin?: boolean;
} | null = {
  id: 'medico-1',
  role: 'MEDICO',
};

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: Object.assign(jest.fn(), {
    persist: { clearStorage: jest.fn() },
    setState: jest.fn(),
  }),
  useAuthUser: () => mockUser,
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    patch: (...args: any[]) => apiPatchMock(...args),
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

function buildProgress(overrides: Record<string, unknown> = {}) {
  return {
    version: 'clinical-v1',
    eligible: true,
    role: 'MEDICO',
    completedStepIds: [],
    dismissedAt: null,
    completedAt: null,
    isComplete: false,
    steps: [
      {
        id: 'review_dashboard',
        title: 'Revisa tu inicio clínico',
        description: 'Ubica atenciones en curso.',
        href: '/',
        actionLabel: 'Ir al inicio',
      },
      {
        id: 'create_patient',
        title: 'Crea tu primer paciente',
        description: 'Registra los datos mínimos.',
        href: '/pacientes/nuevo',
        actionLabel: 'Nuevo paciente',
      },
    ],
    ...overrides,
  };
}

describe('OnboardingPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { id: 'medico-1', role: 'MEDICO' };
    apiGetMock.mockResolvedValue({ data: buildProgress() });
    apiPatchMock.mockImplementation((_url: string, payload: any) =>
      Promise.resolve({
        data: buildProgress({
          completedStepIds: payload.completedStepIds ?? [],
          completedAt: payload.completed ? '2026-05-23T12:00:00.000Z' : null,
          isComplete: Boolean(payload.completed),
        }),
      }),
    );
  });

  it('renders the clinical checklist for eligible users', async () => {
    render(<OnboardingPanel />, { wrapper: createWrapper() });

    expect(await screen.findByText('Guía inicial')).toBeInTheDocument();
    expect(screen.getByText('Revisa tu inicio clínico')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo paciente' })).toHaveAttribute('href', '/pacientes/nuevo');
  });

  it('does not render for admin users', () => {
    mockUser = { id: 'admin-1', role: 'ADMIN', isAdmin: true };

    render(<OnboardingPanel />, { wrapper: createWrapper() });

    expect(screen.queryByText('Guía inicial')).not.toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it('marks a step as completed', async () => {
    render(<OnboardingPanel />, { wrapper: createWrapper() });

    await userEvent.click(await screen.findByRole('button', { name: /Marcar listo: Revisa tu inicio clínico/i }));

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith('/onboarding/me', {
        completedStepIds: ['review_dashboard'],
      });
    });
  });

  it('hides after completing all steps', async () => {
    render(<OnboardingPanel />, { wrapper: createWrapper() });

    await userEvent.click(await screen.findByRole('button', { name: /Marcar todo listo/i }));

    await waitFor(() => {
      expect(screen.queryByText('Guía inicial')).not.toBeInTheDocument();
    });
  });
});
