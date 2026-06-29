import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  DASHBOARD_THEME_STORAGE_KEY,
  DashboardThemeProvider,
  useDashboardTheme,
} from '@/components/layout/DashboardThemeProvider';
import { ThemeSelector } from '@/components/layout/ThemeSelector';

function DashboardThemeProbe() {
  const { theme } = useDashboardTheme();

  return (
    <div data-testid="dashboard-theme-shell" data-dashboard-theme={theme}>
      <ThemeSelector />
    </div>
  );
}

function renderThemeProbe() {
  return render(
    <DashboardThemeProvider>
      <DashboardThemeProbe />
    </DashboardThemeProvider>,
  );
}

describe('DashboardThemeProvider', () => {
  it('uses editorial as the default theme', () => {
    renderThemeProbe();

    expect(screen.getByTestId('dashboard-theme-shell')).toHaveAttribute('data-dashboard-theme', 'editorial');
    expect(screen.getByRole('button', { name: 'Tema Editorial' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('reads a valid stored dashboard theme', async () => {
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, 'dark');

    renderThemeProbe();

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-theme-shell')).toHaveAttribute('data-dashboard-theme', 'dark');
    });
    expect(screen.getByRole('button', { name: 'Tema Oscuro' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores invalid stored dashboard themes', async () => {
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, 'solarized');

    renderThemeProbe();

    await waitFor(() => {
      expect(window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY)).toBeNull();
    });
    expect(screen.getByTestId('dashboard-theme-shell')).toHaveAttribute('data-dashboard-theme', 'editorial');
  });

  it('renders all theme options and updates the dashboard theme attribute', () => {
    renderThemeProbe();

    expect(screen.getByRole('button', { name: 'Tema Claro' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tema Editorial' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tema Oscuro' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tema Oscuro' }));

    expect(screen.getByTestId('dashboard-theme-shell')).toHaveAttribute('data-dashboard-theme', 'dark');
    expect(window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY)).toBe('dark');
  });
});
