import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import DashboardAdminView from '@/app/(dashboard)/DashboardAdminView';

const apiGetMock = jest.fn();

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (err: any) => err?.message || 'Error desconocido',
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('DashboardAdminView', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/health/sqlite') {
        return Promise.resolve({
          data: {
            sqlite: {
              enabled: true,
              backups: {
                latestBackupFile: 'backup-2026-04-18-120000.db',
                latestBackupAt: '2026-04-18T12:00:00.000Z',
                latestBackupAgeHours: 4,
                maxAgeHours: 24,
                isFresh: true,
              },
              restoreDrill: {
                lastRestoreDrillAt: '2026-04-16T09:30:00.000Z',
                lastRestoreDrillAgeDays: 2,
                frequencyDays: 7,
                isDue: false,
              },
            },
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('shows backup freshness and restore drill on the admin dashboard', async () => {
    render(<DashboardAdminView user={{ nombre: 'Admin Demo' }} />, { wrapper: createWrapper() });

    expect(await screen.findByText('Backup y restore drill')).toBeInTheDocument();
    expect(screen.getByText('backup-2026-04-18-120000.db')).toBeInTheDocument();
    expect(screen.getByText('Cadencia objetivo: cada 7 días')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir ajustes del sistema' })).toHaveAttribute('href', '/ajustes?tab=sistema');
  });
});