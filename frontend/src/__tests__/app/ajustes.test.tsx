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
});
