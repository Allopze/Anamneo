import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AjustesPage from '@/app/(dashboard)/ajustes/page';
import type { User } from '@/stores/auth-store';

const replaceMock = jest.fn();
const pushMock = jest.fn();
const apiGetMock = jest.fn();
const apiPutMock = jest.fn();
const apiPostMock = jest.fn();
const apiPatchMock = jest.fn();
const setUserMock = jest.fn();
const logoutMock = jest.fn();
let searchParamsValue = '';

const authStoreState: {
  user: User | null;
  setUser: typeof setUserMock;
  logout: typeof logoutMock;
} = {
  user: {
    id: 'admin-1',
    email: 'admin@anamneo.cl',
    nombre: 'Admin Demo',
    role: 'ADMIN',
    isAdmin: true,
    medicoId: null,
  },
  setUser: setUserMock,
  logout: logoutMock,
};

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => authStoreState,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    put: (...args: any[]) => apiPutMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
    patch: (...args: any[]) => apiPatchMock(...args),
  },
  getErrorMessage: (err: any) => err?.message || 'Error desconocido',
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

describe('AjustesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParamsValue = '';
    authStoreState.user = {
      id: 'admin-1',
      email: 'admin@anamneo.cl',
      nombre: 'Admin Demo',
      role: 'ADMIN',
      isAdmin: true,
      medicoId: null,
    };

    apiGetMock.mockImplementation((url: string) => {
      if (url === '/settings') {
        return Promise.resolve({
          data: {
            'clinic.name': 'Centro Demo',
            'smtp.host': 'smtp.demo.cl',
            'smtp.user': 'mailer@demo.cl',
            'smtp.passwordConfigured': 'true',
            'email.invitationSubject': 'Invitacion {{roleLabel}} - {{clinicName}}',
          },
        });
      }

      if (url === '/health/sqlite') {
        return Promise.resolve({
          data: {
            status: 'degraded',
            database: {
              status: 'ok',
              driver: 'sqlite',
            },
            sqlite: {
              enabled: true,
              status: 'warn',
              files: {
                databaseSizeBytes: 1_572_864,
                walSizeBytes: 262_144,
                walWarnThresholdBytes: 134_217_728,
              },
              backups: {
                latestBackupFile: 'backup-2026-04-18-120000.db',
                latestBackupAt: '2026-04-18T12:00:00.000Z',
                latestBackupAgeHours: 4,
                maxAgeHours: 24,
                isFresh: true,
                backupDirectoryConfigured: true,
              },
              restoreDrill: {
                lastRestoreDrillAt: '2026-04-16T09:30:00.000Z',
                lastRestoreDrillAgeDays: 2,
                frequencyDays: 7,
                isDue: false,
                stateFilePresent: true,
              },
              warnings: ['restore_drill_overdue'],
            },
          },
        });
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    apiPutMock.mockResolvedValue({ data: [] });
    apiPostMock.mockResolvedValue({ data: { sent: true, reason: null, subject: 'Prueba' } });
    apiPatchMock.mockResolvedValue({ data: authStoreState.user });
  });

  it('uses smtp.passwordConfigured without repopulating the SMTP password field', async () => {
    searchParamsValue = 'tab=correo';
    render(<AjustesPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Correo SMTP para invitaciones')).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith('/settings');
    expect(
      await screen.findByText(/Ya existe una clave SMTP guardada\. Este campo solo se usa para reemplazarla\./i),
    ).toBeInTheDocument();

    const passwordInput = screen.getByLabelText('Clave SMTP') as HTMLInputElement;
    expect(passwordInput.value).toBe('');
    expect(passwordInput.placeholder).toContain('Configurada');

    await userEvent.click(screen.getByRole('button', { name: /Guardar correo SMTP/i }));

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/settings', expect.any(Object));
    });

    const [, payload] = apiPutMock.mock.calls[0];
    expect(payload.smtpPassword).toBeUndefined();
    expect(payload.smtpHost).toBe('smtp.demo.cl');
  });

  it('does not query admin settings for a non-admin user', async () => {
    authStoreState.user = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
    };

    render(<AjustesPage />, { wrapper: createWrapper() });

    expect(screen.queryByText('Correo SMTP para invitaciones')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(apiGetMock).not.toHaveBeenCalled();
    });
  });

  it('accepts qrCodeDataUrl when configuring 2FA', async () => {
    authStoreState.user = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
      totpEnabled: false,
    };

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/auth/2fa/setup') {
        return Promise.resolve({
          data: {
            secret: 'SECRET',
            qrCodeDataUrl: 'data:image/png;base64,qr-demo',
          },
        });
      }

      return Promise.resolve({ data: {} });
    });

    render(<AjustesPage />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: 'Configurar 2FA' }));

    const qrImage = await screen.findByAltText('Código QR para 2FA');
    expect(qrImage).toHaveAttribute('src', 'data:image/png;base64,qr-demo');
  });

  it('shows the real activation error instead of blaming the code for every failure', async () => {
    authStoreState.user = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
      totpEnabled: false,
    };

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/auth/2fa/setup') {
        return Promise.resolve({
          data: {
            secret: 'SECRET',
            qrCodeDataUrl: 'data:image/png;base64,qr-demo',
          },
        });
      }

      if (url === '/auth/2fa/enable') {
        return Promise.reject(new Error('Demasiados intentos. Por favor espere un momento antes de reintentar.'));
      }

      return Promise.resolve({ data: {} });
    });

    render(<AjustesPage />, { wrapper: createWrapper() });

    await userEvent.click(screen.getByRole('button', { name: 'Configurar 2FA' }));
    await screen.findByAltText('Código QR para 2FA');
    await userEvent.type(screen.getByLabelText('Código de verificación'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Activar 2FA' }));

    expect(
      await screen.findByText('Demasiados intentos. Por favor espere un momento antes de reintentar.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Código incorrecto/i)).not.toBeInTheDocument();
  });

  it('shows the real disable error instead of blaming the password for every failure', async () => {
    authStoreState.user = {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
      totpEnabled: true,
    };

    apiPostMock.mockImplementation((url: string) => {
      if (url === '/auth/2fa/disable') {
        return Promise.reject(new Error('No se pudo verificar la contraseña en este momento.'));
      }

      return Promise.resolve({ data: {} });
    });

    render(<AjustesPage />, { wrapper: createWrapper() });

    await userEvent.type(screen.getByLabelText(/^Contraseña$/), 'Password1');
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar 2FA' }));

    expect(await screen.findByText('No se pudo verificar la contraseña en este momento.')).toBeInTheDocument();
    expect(screen.queryByText(/^Contraseña incorrecta\.$/)).not.toBeInTheDocument();
  });

  it('logs out and redirects to login after changing password', async () => {
    render(<AjustesPage />, { wrapper: createWrapper() });

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'Admin123');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave9');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'NuevaClave9');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'Admin123',
        newPassword: 'NuevaClave9',
      });
    });

    expect(logoutMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('shows backup and restore drill visibility in the system tab', async () => {
    searchParamsValue = 'tab=sistema';

    render(<AjustesPage />, { wrapper: createWrapper() });

    expect(await screen.findByText('Backup reciente')).toBeInTheDocument();
    expect(screen.getByText('Última prueba de restauración')).toBeInTheDocument();
    expect(screen.getByText('backup-2026-04-18-120000.db')).toBeInTheDocument();
    expect(screen.getByText('Cadencia objetivo: cada 7 días')).toBeInTheDocument();
    expect(screen.getByText('La prueba de restauración ya venció según la cadencia configurada.')).toBeInTheDocument();
    expect(screen.getByText('Checklist operativa')).toBeInTheDocument();
    expect(screen.getByText('Runbook embebido')).toBeInTheDocument();
    expect(screen.getByText('1. Backup fresco')).toBeInTheDocument();
    expect(screen.getByText('npm run db:restore:drill')).toBeInTheDocument();
  });
});
