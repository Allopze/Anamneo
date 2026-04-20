import { render, screen } from '@testing-library/react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const apiGetMock = jest.fn();
const routerReplaceMock = jest.fn();
const routerPushMock = jest.fn();
const loginMock = jest.fn();
const logoutMock = jest.fn();

let mockUser: {
  id: string;
  email: string;
  nombre: string;
  role: 'MEDICO' | 'ASISTENTE' | 'ADMIN';
  isAdmin?: boolean;
  mustChangePassword?: boolean;
} | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplaceMock, push: routerPushMock }),
  usePathname: () => '/',
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    isAxiosError: jest.fn(() => false),
  },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: mockUser,
    isAuthenticated: true,
    hasHydrated: true,
    login: loginMock,
    logout: logoutMock,
  }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    get: (...args: any[]) => apiGetMock(...args),
    post: jest.fn(),
  },
}));

jest.mock('@/lib/session-bootstrap', () => ({
  shouldPreserveLocalSessionOnBootstrapError: jest.fn(() => false),
}));

jest.mock('@/lib/useSessionTimeout', () => ({
  useSessionTimeout: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/components/common/OfflineBanner', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/branding/AnamneoLogo', () => ({
  AnamneoLogo: () => <div data-testid="anamneo-logo" />,
}));

jest.mock('@/components/common/Tooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/layout/SmartHeaderBar', () => ({
  __esModule: true,
  default: () => <div data-testid="smart-header-bar" />,
}));

jest.mock('@/components/layout/DashboardSidebar', () => ({
  __esModule: true,
  default: ({ primaryItems }: { primaryItems: Array<{ name: string }> }) => (
    <div data-testid="dashboard-sidebar">
      {primaryItems.map((item) => (
        <span key={item.name}>{item.name}</span>
      ))}
    </div>
  ),
}));

jest.mock('@/components/layout/MobileSearchOverlay', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/layout/useDashboardSearch', () => ({
  useDashboardSearch: () => ({
    searchQuery: '',
    searchOpen: false,
    searchResults: [],
    searchLoading: false,
    searchActiveIndex: -1,
    setSearchOpen: jest.fn(),
    handleSearchChange: jest.fn(),
    handleSearchNavigate: jest.fn(),
    setSearchActiveIndex: jest.fn(),
    closeSearch: jest.fn(),
  }),
}));

jest.mock('@/lib/auth-session', () => ({
  clearAuthSessionPrefill: jest.fn(),
  consumeAuthSessionPrefill: jest.fn(() => null),
  toAuthUser: (value: unknown) => value,
}));

jest.mock('@/lib/login-redirect', () => ({
  buildLoginRedirectPath: jest.fn(() => '/login'),
  getCurrentAppPath: jest.fn(() => '/'),
}));

describe('DashboardLayout analytics navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'med-1',
      email: 'medico@test.com',
      nombre: 'Medico Demo',
      role: 'MEDICO',
      isAdmin: false,
    };
    apiGetMock.mockResolvedValue({ data: mockUser });
  });

  it('shows the analytics navigation item for non-admin doctors', async () => {
    render(
      <DashboardLayout>
        <div>Contenido</div>
      </DashboardLayout>,
    );

    expect(await screen.findByTestId('dashboard-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Analítica clínica')).toBeInTheDocument();
  });

  it('hides the analytics navigation item for assistants', async () => {
    mockUser = {
      id: 'assistant-1',
      email: 'assistant@test.com',
      nombre: 'Asistente Demo',
      role: 'ASISTENTE',
      isAdmin: false,
    };
    apiGetMock.mockResolvedValue({ data: mockUser });

    render(
      <DashboardLayout>
        <div>Contenido</div>
      </DashboardLayout>,
    );

    expect(await screen.findByTestId('dashboard-sidebar')).toBeInTheDocument();
    expect(screen.queryByText('Analítica clínica')).not.toBeInTheDocument();
  });

  it('hides the analytics navigation item for MEDICO users flagged as admin', async () => {
    mockUser = {
      id: 'med-admin-1',
      email: 'med-admin@test.com',
      nombre: 'Medico Admin',
      role: 'MEDICO',
      isAdmin: true,
    };
    apiGetMock.mockResolvedValue({ data: mockUser });

    render(
      <DashboardLayout>
        <div>Contenido</div>
      </DashboardLayout>,
    );

    expect(await screen.findByTestId('dashboard-sidebar')).toBeInTheDocument();
    expect(screen.queryByText('Analítica clínica')).not.toBeInTheDocument();
  });
});