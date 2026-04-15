import { test, expect, type Page } from '@playwright/test';

/**
 * Clinical workflow E2E: patient → encounter → section editing.
 *
 * Self-contained: bootstraps admin via UI, creates a MEDICO invitation,
 * registers the medico via UI, then uses the medico for all clinical operations.
 */

const ADMIN_EMAIL = 'admin@e2e-test.local';
const ADMIN_PASSWORD = 'TestPass123!';
const MEDICO_EMAIL = 'medico@e2e-test.local';
const MEDICO_PASSWORD = 'MedicoPass123!';
const BOOTSTRAP_TOKEN = 'e2e-bootstrap-token';

const sidebar = (page: Page) =>
  page.getByRole('navigation', { name: 'Navegación principal' });

test.describe('Clinical flow: patient → encounter → sections', () => {
  test.describe.configure({ mode: 'serial' });

  // Setup: register admin (UI) → create invitation (API) → register medico (UI)
  test.beforeAll(async ({ browser }) => {
    // 1. Register admin via UI (same approach as smoke test)
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    await adminPage.goto('/register');
    await adminPage.getByLabel('Nombre completo').fill('Admin E2E');
    await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
    await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
    await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
    await adminPage.getByLabel('Token de instalación').fill(BOOTSTRAP_TOKEN);

    const registerPromise = adminPage.waitForResponse(
      (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
    );
    await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
    const registerResp = await registerPromise;
    console.log(`[beforeAll] Admin register: ${registerResp.status()}`);
    expect(registerResp.status(), 'Admin registration should return 201').toBe(201);

    // Wait for registration to complete and navigate away from register page
    await adminPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });

    // 2. Create medico invitation using admin session cookies
    const inviteResp = await adminPage.request.post('/api/users/invitations', {
      data: { email: MEDICO_EMAIL, role: 'MEDICO' },
    });
    console.log(`[beforeAll] Invite: ${inviteResp.status()}`);
    expect(inviteResp.ok()).toBeTruthy();
    const { token: inviteToken } = await inviteResp.json();
    await adminCtx.close();

    // 3. Register medico via UI (clean context, no admin cookies)
    const medicoCtx = await browser.newContext();
    const medicoPage = await medicoCtx.newPage();

    await medicoPage.goto(`/register?token=${inviteToken}`);
    // Wait for invitation validation to complete (form loads async)
    await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15000 });
    await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba E2E');
    // Email is pre-filled from invitation (read-only)
    await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
    await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);

    const medicoRegPromise = medicoPage.waitForResponse(
      (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
    );
    await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
    const medicoRegResp = await medicoRegPromise;
    const medicoRegBody = await medicoRegResp.text();
    console.log(`[beforeAll] Medico register: ${medicoRegResp.status()} ${medicoRegBody}`);
    expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);

    // Wait for registration to complete
    await medicoPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });

    // Check DB directly
    const { execSync } = require('child_process');
    const dbPath = '/home/allopze/dev/Anamneo/backend/prisma/e2e-playwright.db';
    const dbCheck = execSync(`sqlite3 "${dbPath}" "SELECT count(*) FROM users; SELECT email FROM users;"`).toString();
    console.log(`[beforeAll] DB check after medico reg: ${dbCheck.trim()}`);

    // Check via health endpoint too
    const healthResp = await medicoPage.request.get('/api/health');
    console.log(`[beforeAll] Health: ${healthResp.status()}`);

    await medicoCtx.close();
  });

  async function loginAsMedico(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill(MEDICO_EMAIL);
    await page.getByLabel('Contraseña').fill(MEDICO_PASSWORD);

    const loginPromise = page.waitForResponse(
      (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    const loginResp = await loginPromise;
    const loginBody = await loginResp.text();
    console.log(`[loginAsMedico] ${loginResp.status()} ${loginBody}`);
    expect(loginResp.status(), `Login failed with ${loginResp.status()}: ${loginBody}`).toBe(200);

    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
    await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
  }

  test('create patient with full registration', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);

    await page.goto('/pacientes/nuevo');
    await expect(
      page.getByRole('heading', { name: /nuevo paciente/i }),
    ).toBeVisible({ timeout: 15000 });

    // Fill full registration
    await page.getByLabel('Nombre completo').fill('María Eugenia Flores Tapia');
    await page.getByLabel('RUT').fill('12.345.678-5');
    await page.getByLabel('Fecha de nacimiento').fill('1980-06-15');
    await page.getByLabel('Sexo').selectOption('FEMENINO');
    await page.getByLabel('Previsión de salud').selectOption('FONASA');

    await page.getByRole('button', { name: /guardar paciente/i }).click();

    // Should land on patient detail
    await expect(
      page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/pacientes\/[a-zA-Z0-9-]+$/);
  });

  test('verify patient ficha if needed', async ({ page }) => {
    test.setTimeout(30_000);
    await loginAsMedico(page);

    await page.goto('/pacientes');
    await page.getByText('María Eugenia Flores Tapia').first().click();
    await expect(
      page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
    ).toBeVisible({ timeout: 10000 });

    // Verify ficha if the validation banner is present
    const verifyBtn = page.getByRole('button', { name: /validar ficha/i });
    if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await verifyBtn.click();
      await expect(page.getByText(/verificada/i)).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('patient search returns the new patient', async ({ page }) => {
    test.setTimeout(30_000);
    await loginAsMedico(page);

    await page.goto('/pacientes');
    await expect(
      page.getByRole('heading', { name: 'Pacientes' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByPlaceholder('Buscar por nombre o RUT').fill('Flores Tapia');
    await expect(
      page.getByText('María Eugenia Flores Tapia'),
    ).toBeVisible({ timeout: 5000 });
  });

  test('create encounter and fill motivo de consulta', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);

    // Navigate to patient detail
    await page.goto('/pacientes');
    await page.getByText('María Eugenia Flores Tapia').first().click();
    await expect(
      page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
    ).toBeVisible({ timeout: 10000 });

    // Create encounter
    await page.getByRole('button', { name: /nueva atención/i }).click();
    await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/, {
      timeout: 15000,
    });

    // Encounter header shows patient name
    await expect(
      page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
    ).toBeVisible();

    // Navigate past Identificación to Motivo de Consulta
    await page.getByRole('button', { name: /siguiente/i }).click();

    // Fill the motivo textarea
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(
      'Dolor abdominal agudo de 3 días de evolución, localizado en fosa ilíaca derecha.',
    );

    // Save and verify
    await page.getByRole('button', { name: 'Guardar Ahora' }).click();
    await expect(page.locator('[role="status"]')).toContainText(/guardad/i, {
      timeout: 10000,
    });
  });
});
