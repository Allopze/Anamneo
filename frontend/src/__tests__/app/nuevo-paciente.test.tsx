import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NuevoPacientePage from '@/app/(dashboard)/pacientes/nuevo/page';
import { todayLocalDateString } from '@/lib/date';

const pushMock = jest.fn();
const toastSuccessMock = jest.fn();
const toastErrorMock = jest.fn();
const apiGetMock = jest.fn();
const apiPostMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: {
      id: 'med-1',
      email: 'medico@anamneo.cl',
      nombre: 'Dra. Rivera',
      role: 'MEDICO',
      isAdmin: false,
      medicoId: null,
    },
    isMedico: () => true,
    canCreatePatient: () => true,
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: (...args: any[]) => apiPostMock(...args),
  },
  getErrorMessage: (error: any) => error?.message || 'Error desconocido',
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args: any[]) => toastSuccessMock(...args),
    error: (...args: any[]) => toastErrorMock(...args),
  },
}));

describe('NuevoPacientePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiGetMock.mockResolvedValue({ data: { data: [] } });
    apiPostMock.mockResolvedValue({ data: { id: 'patient-1' } });
  });

  it('submits successfully using fecha de nacimiento to calculate edad', async () => {
    const user = userEvent.setup();
    const today = todayLocalDateString();

    render(<NuevoPacientePage />);

    await user.type(screen.getByLabelText(/Nombre completo/i), 'Paciente Demo');
    await user.type(screen.getByLabelText(/Fecha de nacimiento/i), today);
    await user.selectOptions(screen.getByLabelText(/^Sexo/i), 'FEMENINO');
    await user.selectOptions(screen.getByLabelText(/Previsión de salud/i), 'FONASA');
    await user.click(screen.getByRole('button', { name: /Guardar paciente/i }));

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalled();
    });

    const payload = apiPostMock.mock.calls[0][1];
    expect(payload.fechaNacimiento).toBe(today);
    expect(payload.edad).toBe(0);
    expect(payload.edadMeses).toBe(0);
    expect(toastSuccessMock).toHaveBeenCalledWith('Paciente creado correctamente');
    expect(pushMock).toHaveBeenCalledWith('/pacientes/patient-1');
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('shows a warning when a possible duplicate is detected before saving', async () => {
    const user = userEvent.setup();

    apiGetMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'patient-dup',
            nombre: 'Paciente Demo',
            rut: '12.345.678-5',
            fechaNacimiento: '2020-05-15',
            registrationMode: 'COMPLETO',
            completenessStatus: 'VERIFICADA',
            matchReasons: ['same_name_birth_date'],
          },
        ],
      },
    });

    render(<NuevoPacientePage />);

    await user.type(screen.getByLabelText(/Nombre completo/i), 'Paciente Demo');
    await user.type(screen.getByLabelText(/Fecha de nacimiento/i), '2020-05-15');

    expect(await screen.findByText('Posibles pacientes duplicados')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir ficha/i })).toHaveAttribute(
      'href',
      '/pacientes/patient-dup',
    );

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/patients/possible-duplicates', {
        params: expect.objectContaining({
          nombre: 'Paciente Demo',
          fechaNacimiento: '2020-05-15',
        }),
      });
    });
  });
});