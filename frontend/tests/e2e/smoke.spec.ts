import { test, expect } from '@playwright/test';

/**
 * Smoke E2E tests that exercise the full stack: Playwright → Next.js → NestJS → SQLite.
 *
 * The backend is started via Playwright webServer config with a dedicated test DB.
 */

const ADMIN_EMAIL = 'admin@e2e-test.local';
const ADMIN_PASSWORD = 'TestPass123!';
const ADMIN_NOMBRE = 'Admin E2E';
const BOOTSTRAP_TOKEN = 'e2e-bootstrap-token';

test('full smoke: register, verify dashboard', async ({ page }) => {
  test.setTimeout(60_000);

  // --- Register ---
  await page.goto('/register');
  await page.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
  await page.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
  await page.getByLabel('Token de instalación').fill(BOOTSTRAP_TOKEN);
  await page.getByRole('button', { name: /Crear cuenta/i }).click();

  // Should land on dashboard with sidebar
  const sidebar = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(sidebar).toBeVisible({ timeout: 15000 });

  // Verify sidebar contains expected navigation links for ADMIN role
  await expect(sidebar.getByRole('link', { name: /pacientes/i })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: /ajustes/i })).toBeVisible();
});

test('private route redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/pacientes');
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
});
