import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import CatalogoPage from '@/app/(dashboard)/catalogo/page';

const apiGetMock = jest.fn();
let categoryValue = '';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(categoryValue),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: 'admin-1', role: 'ADMIN', isAdmin: true },
    isAdmin: () => true,
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
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
  categoryValue = '';

  apiGetMock.mockImplementation((url: string) => {
    if (url.startsWith('/conditions?')) {
      return Promise.resolve({
        data: [
          {
            id: 'cond-1',
            name: 'Gastritis',
            synonyms: ['dispepsia'],
            tags: ['digestivo'],
            active: true,
            scope: 'GLOBAL',
          },
        ],
      });
    }

    if (url.startsWith('/medications?')) {
      return Promise.resolve({
        data: [
          {
            id: 'med-1',
            name: 'Omeprazol',
            activeIngredient: 'Omeprazol',
            active: true,
          },
        ],
      });
    }

    throw new Error(`Unexpected GET ${url}`);
  });
});

describe('CatalogoPage', () => {
  it('shows conditions by default and queries the conditions endpoint', async () => {
    render(<CatalogoPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: 'Afecciones' })).toBeInTheDocument();
    expect(await screen.findByText('Gastritis')).toBeInTheDocument();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/conditions?');
    });
  });

  it('switches to medications when categoria=medicamentos', async () => {
    categoryValue = 'categoria=medicamentos';

    render(<CatalogoPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole('heading', { name: 'Medicamentos' })).toBeInTheDocument();
    expect(await screen.findByText('Omeprazol')).toBeInTheDocument();
    expect(await screen.findByText(/Principio activo: Omeprazol/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/medications?');
    });
  });
});