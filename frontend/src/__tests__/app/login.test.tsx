import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';

// Mock next/navigation
const pushMock = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: () => null }),
}));

// Mock api
const apiPostMock = jest.fn();
const apiGetMock = jest.fn();
jest.mock('@/lib/api', () => ({
  api: {
    post: (...args: any[]) => apiPostMock(...args),
    get: (...args: any[]) => apiGetMock(...args),
  },
  getErrorMessage: (err: any) => err?.message || 'Error desconocido',
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
});

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('shows validation errors for empty submit', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(screen.getByText('Ingresa un correo electrónico válido')).toBeInTheDocument();
      expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
    });
  });

  it('does not submit with invalid email', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

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
    apiPostMock.mockResolvedValueOnce({});
    apiGetMock.mockResolvedValueOnce({
      data: {
        id: '1',
        email: 'doc@test.cl',
        nombre: 'Dr. Test',
        role: 'MEDICO',
        isAdmin: false,
        medicoId: null,
      },
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Correo electrónico'), 'doc@test.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'Password1');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith('/auth/login', {
        email: 'doc@test.cl',
        password: 'Password1',
      });
      expect(pushMock).toHaveBeenCalledWith('/pacientes');
    });
  });

  it('shows error on 401 response', async () => {
    const axiosError = new Error('Unauthorized');
    Object.assign(axiosError, { response: { status: 401 }, isAxiosError: true });
    apiPostMock.mockRejectedValueOnce(axiosError);

    // Mock axios.isAxiosError
    jest.spyOn(require('axios'), 'isAxiosError').mockReturnValue(true);

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Correo electrónico'), 'doc@test.cl');
    await user.type(screen.getByLabelText('Contraseña'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    await waitFor(() => {
      expect(
        screen.getByText('Credenciales incorrectas. Verifica tu correo y contraseña.')
      ).toBeInTheDocument();
    });
  });

  it('has link to register page', () => {
    render(<LoginPage />);
    const link = screen.getByText('Crear cuenta');
    expect(link).toHaveAttribute('href', '/register');
  });
});
