import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN } from './e2e-identities';

/**
 * Smoke E2E tests that exercise the full stack: Playwright → Next.js → NestJS → SQLite.
 *
 * The backend is started via Playwright webServer config with a dedicated test DB.
 */

test('full smoke: bootstrap-aware access flow', async ({ page, request }) => {
  test.setTimeout(60_000);

  const bootstrapResponse = await request.get('/api/auth/bootstrap');
  expect(bootstrapResponse.ok()).toBeTruthy();
  const bootstrapState = (await bootstrapResponse.json()) as {
    hasAdmin?: boolean;
  };

  await page.goto('/register');

  if (bootstrapState.hasAdmin) {
    await expect(page.getByText(/Necesita una invitación válida para crear una cuenta\./i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('Token de instalación')).toHaveCount(0);
    return;
  }

  // --- Register ---
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
