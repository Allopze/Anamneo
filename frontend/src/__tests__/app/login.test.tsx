import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';

// Mock next/navigation
const pushMock = jest.fn();
let fromParam: string | null = null;
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: (key: string) => (key === 'from' ? fromParam : null) }),
}));

// Mock api
const apiPostMock = jest.fn();
const apiGetMock = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: any[]) => apiPostMock(...args),
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (err: any) => {
    const data = err?.response?.data;
    if (Array.isArray(data?.message)) {
      return data.message.filter(Boolean).join('\n');
    }
    if (typeof data?.message === 'string' && data.message.trim().length > 0) {
      return data.message;
    }
    return err?.message || 'Error desconocido';
  },
}));

// Mock toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

// Mock logo (SVG component)
jest.mock('@/components/branding/AnamneoLogo', () => ({
  AnamneoLogo: () => <div data-testid="logo">Logo</div>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  fromParam = null;
  apiGetMock.mockResolvedValue({
    data: {
      hasAdmin: true,
      requiresBootstrapToken: false,
    },
  });
});

async function renderLoginPage() {
  render(<LoginPage />);
  await waitFor(() => {
    expect(apiGetMock).toHaveBeenCalledWith('/auth/bootstrap');
  });
}

describe('LoginPage', () => {
  it('renders login form', async () => {
    await renderLoginPage();
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('shows validation errors for empty submit', async () => {
    const user = userEvent.setup();
    await renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(screen.getByText('Ingresa un correo electrónico válido')).toBeInTheDocument();
      expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
    });
  });

  it('does not submit with invalid email', async () => {
    const user = userEvent.setup();
    await renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'somepassword');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    // Give the form time to attempt submission
    await waitFor(() => {
      // API should NOT have been called with invalid email
      expect(apiPostMock).not.toHaveBeenCalled();
    });
  });

  it('submits valid credentials and redirects', async () => {
    apiPostMock.mockResolvedValueOnce({
      data: {
        user: {
          id: '1',
          email: 'doc@test.cl',
          nombre: 'Dr. Test',
          role: 'MEDICO',
          isAdmin: false,
          medicoId: null,
          mustChangePassword: false,
          totpEnabled: false,
        },
      },
    });

    const user = userEvent.setup();
  await renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'doc@test.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/auth/login', {
        email: 'doc@test.cl',
        password: 'Password1',
      });
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });

  it('uses the safe from parameter when returning after login', async () => {
    fromParam = '/atenciones/enc-1?panel=review';
    apiPostMock.mockResolvedValueOnce({
      data: {
        user: {
          id: '1',
          email: 'doc@test.cl',
          nombre: 'Dr. Test',
          role: 'MEDICO',
          isAdmin: false,
          medicoId: null,
          mustChangePassword: false,
          totpEnabled: false,
        },
      },
    });

    const user = userEvent.setup();
  await renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'doc@test.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/atenciones/enc-1?panel=review');
    });
  });

  it('allows completing the 2FA step with a recovery code', async () => {
    apiPostMock
      .mockResolvedValueOnce({
        data: {
          requires2FA: true,
          tempToken: 'temp-token',
        },
      })
      .mockResolvedValueOnce({
        data: {
          user: {
            id: '1',
            email: 'doc@test.cl',
            nombre: 'Dr. Test',
            role: 'MEDICO',
            isAdmin: false,
            medicoId: null,
            mustChangePassword: false,
            totpEnabled: true,
          },
        },
      });

    const user = userEvent.setup();
  await renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'doc@test.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(await screen.findByText('Verificación 2FA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Usar código de recuperación' }));
    await user.type(screen.getByLabelText('Código de recuperación'), 'ABCD-EFGH');
    await user.click(screen.getByRole('button', { name: 'Verificar código' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenNthCalledWith(2, '/auth/2fa/verify', {
        tempToken: 'temp-token',
        code: 'ABCD-EFGH',
      });
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });

  it('shows error on 401 response', async () => {
    const axiosError = new Error('Unauthorized');
    Object.assign(axiosError, { response: { status: 401 }, isAxiosError: true });
    apiPostMock.mockRejectedValueOnce(axiosError);

    // Mock axios.isAxiosError
    jest.spyOn(require('axios'), 'isAxiosError').mockReturnValue(true);

    const user = userEvent.setup();
  await renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'doc@test.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(
        screen.getByText('Credenciales incorrectas. Verifica tu correo y contraseña.')
      ).toBeInTheDocument();
    });
  });

  it('shows lockout detail when backend returns a specific 401 message', async () => {
    const axiosError = new Error('Unauthorized');
    Object.assign(axiosError, {
      response: {
        status: 401,
        data: { message: 'Cuenta bloqueada temporalmente. Intente en 15 minuto(s).' },
      },
      isAxiosError: true,
    });
    apiPostMock.mockRejectedValueOnce(axiosError);

    jest.spyOn(require('axios'), 'isAxiosError').mockReturnValue(true);

    const user = userEvent.setup();
  await renderLoginPage();

    await user.type(screen.getByLabelText('Correo electrónico'), 'doc@test.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(
        screen.getByText('Cuenta bloqueada temporalmente. Intente en 15 minuto(s).')
      ).toBeInTheDocument();
    });
  });

  it('shows invitation guidance when public registration is closed', async () => {
    await renderLoginPage();

    expect(await screen.findByText('¿Necesitas acceso? Pide una invitación válida al administrador del espacio clínico.')).toBeInTheDocument();
    expect(screen.queryByText('Crear cuenta')).not.toBeInTheDocument();
  });

  it('shows the register CTA when bootstrap registration is still open', async () => {
    apiGetMock.mockResolvedValueOnce({
      data: {
        hasAdmin: false,
        requiresBootstrapToken: true,
      },
    });

    await renderLoginPage();

    const link = await screen.findByRole('link', { name: /Crear cuenta/i });
    expect(link).toHaveAttribute('href', '/register');
  });
});
