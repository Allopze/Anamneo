import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditoriaPage from '@/app/(dashboard)/admin/auditoria/page';

const pushMock = jest.fn();
let isAdminValue = true;
const apiGetMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthIsAdmin: () => isAdminValue,
  useAuthStore: () => ({
    isAdmin: () => isAdminValue,
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (err: any) => err?.message || 'Error desconocido',
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

beforeEach(() => {
  jest.clearAllMocks();
  isAdminValue = true;

  apiGetMock.mockImplementation((url: string) => {
    if (url === '/users') {
      return Promise.resolve({
        data: [
          { id: 'user-1', nombre: 'Dra. Rivera', email: 'rivera@test.cl' },
        ],
      });
    }

    if (url === '/audit/integrity/latest') {
      return Promise.resolve({
        data: {
          valid: true,
          checked: 1,
          total: 1,
          verifiedAt: '2026-03-31T12:00:00.000Z',
          verificationScope: 'LIMIT_1000',
        },
      });
    }

    if (url === '/audit/integrity/verify?limit=1000' || url === '/audit/integrity/verify?full=true') {
      return Promise.resolve({
        data: {
          valid: true,
          checked: 1,
          total: 1,
          verifiedAt: '2026-03-31T12:05:00.000Z',
          verificationScope: url.endsWith('full=true') ? 'FULL' : 'LIMIT_1000',
        },
      });
    }

    if (url.startsWith('/audit?')) {
      return Promise.resolve({
        data: {
          data: [
            {
              id: 'audit-1',
              entityType: 'PatientExport',
              entityId: 'csv',
              userId: 'user-1',
              requestId: 'req-12345678',
              action: 'EXPORT',
              reason: 'PATIENT_EXPORT_CSV',
              result: 'SUCCESS',
              diff: JSON.stringify({ redacted: true, entityType: 'PatientExport', export: { format: 'csv' } }),
              timestamp: '2026-03-31T12:00:00.000Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 30,
            total: 1,
            totalPages: 1,
          },
        },
      });
    }

    throw new Error(`Unexpected GET ${url}`);
  });
});

describe('AuditoriaPage', () => {
  it('renders audit rows and opens the diff modal', async () => {
    render(<AuditoriaPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Cadena íntegra')).toBeInTheDocument();
    expect(screen.getByText('Entradas verificadas')).toBeInTheDocument();

    const openDiffButton = await screen.findByRole('button', { name: 'Ver diff' });
    const table = screen.getByRole('table');
    expect(openDiffButton).toBeInTheDocument();
    expect(within(table).getByText('Exportación de pacientes')).toBeInTheDocument();
    expect(within(table).getByText('Exitoso')).toBeInTheDocument();

    await userEvent.click(openDiffButton);

    expect(await screen.findByText('Detalle de auditoría')).toBeInTheDocument();
    expect(screen.getByText('Diff redactado')).toBeInTheDocument();
    expect(screen.getByText(/"redacted": true/)).toBeInTheDocument();
  });

  it('applies reason and result filters to the audit query', async () => {
    render(<AuditoriaPage />, { wrapper: createWrapper() });

    await screen.findByText('Auditoría');

    await userEvent.selectOptions(screen.getByLabelText('Motivo'), 'PATIENT_EXPORT_CSV');
    await userEvent.selectOptions(screen.getByLabelText('Resultado'), 'SUCCESS');

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        expect.stringContaining('/audit?page=1&limit=30&reason=PATIENT_EXPORT_CSV&result=SUCCESS'),
      );
    });
  });
});
