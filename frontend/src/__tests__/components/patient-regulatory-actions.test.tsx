import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PatientRegulatoryActions from '@/components/PatientRegulatoryActions';
import type { Patient } from '@/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const downloadRegulatoryMock = jest.fn();
const apiDeleteMock = jest.fn();
const routerPushMock = jest.fn();
const notifySuccessMock = jest.fn();
const notifyErrorMock = jest.fn();

// Mock the helper directly so we don't need to wrestle with blob/URL/DOM APIs
// in a component render context.
jest.mock('@/app/(dashboard)/pacientes/[id]/patient-detail.helpers', () => ({
  downloadPatientRegulatoryExport: (...args: unknown[]) => downloadRegulatoryMock(...args),
  downloadPatientExportBundle: jest.fn(),
  downloadPatientHistoryPdf: jest.fn(),
  normalizeTaskUpdatePayload: jest.fn((p: unknown) => p),
}));

jest.mock('@/lib/api', () => ({
  api: {
    delete: (...args: unknown[]) => apiDeleteMock(...args),
  },
  getErrorMessage: (e: unknown) => (e as Error)?.message ?? 'Error',
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

jest.mock('@/lib/notify', () => ({
  notify: {
    success: (...args: unknown[]) => notifySuccessMock(...args),
    error: (...args: unknown[]) => notifyErrorMock(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const PATIENT = {
  id: 'patient-1',
  nombre: 'Ana Soto López',
} as Patient;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PatientRegulatoryActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isAdmin is false', () => {
    const { container } = render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin={false} />,
      { wrapper: makeWrapper() },
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the regulatory actions section for admins', () => {
    render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText(/Acciones regulatorias/i)).toBeInTheDocument();
    expect(screen.getByText(/Exportar paquete regulatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/Suprimir paciente/i)).toBeInTheDocument();
  });

  it('calls the regulatory export helper on button click', async () => {
    downloadRegulatoryMock.mockResolvedValueOnce(undefined);

    render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin />,
      { wrapper: makeWrapper() },
    );

    fireEvent.click(screen.getByText(/Exportar paquete regulatorio/i));

    await waitFor(() => {
      expect(downloadRegulatoryMock).toHaveBeenCalledWith('patient-1', PATIENT);
      expect(notifySuccessMock).toHaveBeenCalledWith('Paquete regulatorio descargado');
    });
  });

  it('shows error notification when regulatory export fails', async () => {
    downloadRegulatoryMock.mockRejectedValueOnce(new Error('Server error'));

    render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin />,
      { wrapper: makeWrapper() },
    );

    fireEvent.click(screen.getByText(/Exportar paquete regulatorio/i));

    await waitFor(() => {
      expect(notifyErrorMock).toHaveBeenCalledWith('Server error');
    });
  });

  it('opens the purge modal when clicking the purge button', () => {
    render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin />,
      { wrapper: makeWrapper() },
    );

    fireEvent.click(screen.getByText(/Suprimir paciente/i));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Escribe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Justificación/i)).toBeInTheDocument();
  });

  it('rejects purge when the confirmation word is wrong', async () => {
    render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin />,
      { wrapper: makeWrapper() },
    );

    fireEvent.click(screen.getByText(/Suprimir paciente/i));

    fireEvent.change(screen.getByLabelText(/Escribe/i), { target: { value: 'WRONG' } });
    fireEvent.change(screen.getByLabelText(/Justificación/i), {
      target: { value: 'Razón legal suficientemente larga para el test' },
    });

    fireEvent.click(screen.getByText('Confirmar supresión'));

    await waitFor(() => {
      expect(notifyErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('PURGE-REGULATORY'),
      );
    });
    expect(apiDeleteMock).not.toHaveBeenCalled();
  });

  it('rejects purge when justification is too short', async () => {
    render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin />,
      { wrapper: makeWrapper() },
    );

    fireEvent.click(screen.getByText(/Suprimir paciente/i));

    fireEvent.change(screen.getByLabelText(/Escribe/i), {
      target: { value: 'PURGE-REGULATORY' },
    });
    fireEvent.change(screen.getByLabelText(/Justificación/i), {
      target: { value: 'Corta' },
    });

    fireEvent.click(screen.getByText('Confirmar supresión'));

    await waitFor(() => {
      expect(notifyErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('20 caracteres'),
      );
    });
    expect(apiDeleteMock).not.toHaveBeenCalled();
  });

  it('executes purge and redirects on success', async () => {
    apiDeleteMock.mockResolvedValueOnce({ data: { ok: true } });

    render(
      <PatientRegulatoryActions patient={PATIENT} isAdmin />,
      { wrapper: makeWrapper() },
    );

    fireEvent.click(screen.getByText(/Suprimir paciente/i));

    fireEvent.change(screen.getByLabelText(/Escribe/i), {
      target: { value: 'PURGE-REGULATORY' },
    });
    fireEvent.change(screen.getByLabelText(/Justificación/i), {
      target: { value: 'Derecho de supresión ejercido por el titular conforme Art. 11 Ley 21.719' },
    });

    fireEvent.click(screen.getByText('Confirmar supresión'));

    await waitFor(() => {
      expect(apiDeleteMock).toHaveBeenCalledWith('/patients/patient-1/purge', {
        data: {
          confirmation: 'PURGE-REGULATORY',
          justification: 'Derecho de supresión ejercido por el titular conforme Art. 11 Ley 21.719',
        },
      });
      expect(notifySuccessMock).toHaveBeenCalledWith('Paciente suprimido definitivamente');
      expect(routerPushMock).toHaveBeenCalledWith('/pacientes');
    });
  });
});
