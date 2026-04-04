import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

jest.mock('@/components/layout/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

jest.mock('@/app/(dashboard)/page', () => ({
  __esModule: true,
  default: () => <div data-testid="dashboard-page">Dashboard content</div>,
}));

describe('HomePage', () => {
  it('mounts the dashboard page inside DashboardLayout', () => {
    render(<HomePage />);

    expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });
});