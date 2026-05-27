import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN } from './e2e-identities';
import { gotoApp } from './helpers/navigation';

/**
 * Smoke E2E tests that exercise the full stack: Playwright -> Next.js -> NestJS -> PostgreSQL.
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

  await gotoApp(page, '/register');

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
  await page.getByRole('checkbox', { name: /Acepto los/i }).check();
  await page.getByRole('button', { name: /Crear cuenta/i }).click();

  // Should land on dashboard with sidebar
  const sidebar = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(sidebar).toBeVisible({ timeout: 15000 });

  // Verify sidebar contains expected navigation links for ADMIN role
  await expect(sidebar.getByRole('link', { name: /pacientes/i })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: /ajustes/i })).toBeVisible();

  const medicosResp = await page.request.get('/api/users/reassignment-medicos');
  expect(medicosResp.ok(), 'Admin can list reassignment medico targets').toBeTruthy();

  const rejectedMaintenanceResp = await page.request.post('/api/admin/maintenance/audit-legacy-plaintext', {
    data: {
      confirmation: 'AUDITAR',
      reason: 'validacion smoke de mantenimiento admin',
    },
  });
  expect(rejectedMaintenanceResp.status(), 'Invalid maintenance confirmation should be rejected').toBe(400);

  const maintenanceResp = await page.request.post('/api/admin/maintenance/audit-legacy-plaintext', {
    data: {
      confirmation: 'AUDITAR PLAINTEXT LEGACY',
      reason: 'validacion smoke de mantenimiento admin',
    },
  });
  expect(maintenanceResp.ok(), 'Admin maintenance plaintext audit should succeed').toBeTruthy();
});

test('private route redirects to login when unauthenticated', async ({ page }) => {
  await gotoApp(page, '/pacientes');
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
});
