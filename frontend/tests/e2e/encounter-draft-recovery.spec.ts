import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN, MEDICO_PASSWORD, RUN_ID } from './e2e-identities';
import { gotoApp } from './helpers/navigation';

/**
 * E2E: draft recovery with real Playwright session.
 *
 * Self-contained: bootstraps admin via UI, creates a MEDICO invitation,
 * registers the medico via UI, then exercises the full draft lifecycle:
 * patient → encounter → section edit → localStorage draft → session restore → draft recovery.
 *
 * This replaces the original skipped test that used mocked /api/auth/me route.
 * The mock bypassed real auth and could not verify that the backend enforces
 * session validity, cookies and CORS — all of which must work for PHI safety.
 */

const sidebar = (page: Page) =>
  page.getByRole('navigation', { name: 'Navegación principal' });
const MEDICO_EMAIL = `medico+draft-recovery+${RUN_ID}@e2e-test.local`;

/**
 * Login helper — restores the real medico session captured in beforeAll.
 * Mirrors the pattern from workflow-clinical.spec.ts.
 */
async function loginAsMedico(page: Page, cookies: Awaited<ReturnType<BrowserContext['cookies']>>) {
  expect(cookies.length, 'Medico auth cookies should be available from beforeAll setup').toBeGreaterThan(0);
  await page.context().addCookies(cookies);
  await gotoApp(page, '/');
  await expect(sidebar(page)).toBeVisible({ timeout: 20_000 });
}

test.describe('Draft recovery with real Playwright session', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);

  let medicoAuthCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
  let encounterId = '';
  let patientId = '';
  const draftNote = 'Paciente relata cefalea pulsátil con fotofobia desde hace 3 días.';

  // ── Setup: bootstrap admin → create invitation → register medico ──────────
  test.beforeAll(async ({ browser }) => {
    // 1. Bootstrap or reuse admin
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    const bootstrapResp = await adminPage.request.get('/api/auth/bootstrap');
    expect(bootstrapResp.ok(), 'Bootstrap status request should succeed').toBeTruthy();
    const bootstrapState = (await bootstrapResp.json()) as { hasAdmin?: boolean };
    const needsBootstrapRegistration = !bootstrapState.hasAdmin;

    if (needsBootstrapRegistration) {
      await gotoApp(adminPage, '/register');
      const bootstrapTokenInput = adminPage.getByLabel('Token de instalación');
      await adminPage.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
      await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
      await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
      await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
      await bootstrapTokenInput.fill(BOOTSTRAP_TOKEN);
      await adminPage.getByRole('checkbox', { name: /Acepto los/i }).check();

      const registerPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
      );
      await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
      const registerResp = await registerPromise;
      expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
      await adminPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20_000 });
    } else {
      await gotoApp(adminPage, '/login');
      await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
      await adminPage.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
      await adminPage.getByRole('button', { name: 'Iniciar sesión' }).click();
      await expect(sidebar(adminPage)).toBeVisible({ timeout: 20_000 });
    }

    // 2. Create medico invitation
    const inviteResp = await adminPage.request.post('/api/users/invitations', {
      data: { email: MEDICO_EMAIL, role: 'MEDICO' },
    });
    expect(inviteResp.ok()).toBeTruthy();
    const { token: inviteToken } = await inviteResp.json();
    await adminCtx.close();

    // 3. Register medico via UI
    const medicoCtx = await browser.newContext();
    const medicoPage = await medicoCtx.newPage();

    await gotoApp(medicoPage, `/register?token=${inviteToken}`);
    await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15_000 });
    await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba E2E');
    await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
    await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);
    await medicoPage.getByRole('checkbox', { name: /Acepto los/i }).check();

    const medicoRegPromise = medicoPage.waitForResponse(
      (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
    );
    await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
    const medicoRegResp = await medicoRegPromise;
    expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);
    await medicoPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20_000 });
    await expect(sidebar(medicoPage)).toBeVisible({ timeout: 20_000 });

    // 4. Capture cookies for reuse in test body
    medicoAuthCookies = await medicoCtx.cookies();
    await medicoCtx.close();
  });

  // ── Test: create patient + encounter, save draft, restore session ──────────
  test('recovers the local draft when the clinical session is restored', async ({ browser }) => {
    // 1. Login with real session
    const sessionCtx = await browser.newContext();
    const sessionPage = await sessionCtx.newPage();
    await loginAsMedico(sessionPage, medicoAuthCookies);

    // 2. Create patient via UI (same pattern as workflow-clinical.spec.ts)
    await gotoApp(sessionPage, '/pacientes/nuevo');
    await expect(
      sessionPage.getByRole('heading', { name: /nuevo paciente/i }),
    ).toBeVisible({ timeout: 15_000 });

    await sessionPage.getByLabel('Nombre completo').fill('Paciente Draft Recovery');
    await sessionPage.getByLabel('RUT', { exact: true }).fill('22.222.222-2');
    await sessionPage.getByLabel('Fecha de nacimiento').fill('1986-03-20');
    await sessionPage.getByLabel('Sexo').selectOption('FEMENINO');
    await sessionPage.getByLabel('Previsión de salud').selectOption('FONASA');
    await sessionPage.getByRole('button', { name: /guardar paciente/i }).click();

    await expect(sessionPage.getByRole('heading', { name: 'Paciente Draft Recovery' })).toBeVisible({ timeout: 10_000 });
    await expect(sessionPage.getByRole('button', { name: /nueva atención/i })).toBeVisible({ timeout: 10_000 });
    const patientUrl = sessionPage.url();
    patientId = patientUrl.split('/pacientes/')[1]!;

    // 3. Create encounter via UI
    await sessionPage.getByRole('button', { name: /nueva atención/i }).click();
    // Wizard starts at "Identificación del paciente" — navigate to "Motivo de consulta"
    await expect(
      sessionPage.getByRole('heading', { name: 'Identificación del paciente' }),
    ).toBeVisible({ timeout: 15_000 });
    await sessionPage.getByRole('button', { name: /siguiente/i }).click();
    await expect(sessionPage.getByRole('heading', { name: /motivo de consulta/i })).toBeVisible({ timeout: 10_000 });
    const encounterUrl = sessionPage.url();
    encounterId = encounterUrl.split('/atenciones/')[1]!;

    // 4. Fill MOTIVO_CONSULTA section
    const motivoTextarea = sessionPage.getByPlaceholder(
      'Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz...',
    );
    await motivoTextarea.fill(draftNote);

    // 5. Get the real userId from the auth store (sessionStorage, not localStorage)
    const realUserId = await sessionPage.evaluate(() => {
      const authRaw = window.sessionStorage.getItem('auth-storage');
      if (authRaw) {
        try {
          const auth = JSON.parse(authRaw);
          return auth.state?.user?.id;
        } catch { /* ignore */ }
      }
      return null;
    });
    expect(realUserId, 'Should be able to read the logged-in user ID from sessionStorage').toBeTruthy();

    // 6. Verify draft is persisted in localStorage with the real userId
    const draftStored = await sessionPage.evaluate(
      ([encId, uid]) => {
        const raw = window.localStorage.getItem(`anamneo:encounter-draft:v2:${uid}:${encId}`);
        return raw ? JSON.parse(raw) : null;
      },
      [encounterId, realUserId] as unknown as [string, string],
    );
    expect(draftStored, 'Draft should be stored in localStorage').toBeTruthy();
    expect(
      (draftStored as { formData?: { MOTIVO_CONSULTA?: { texto?: string } } }).formData?.MOTIVO_CONSULTA?.texto,
      'Draft should contain the entered note',
    ).toBe(draftNote);

    // 7. Simulate session restore: navigate away and back within the same context.
    //    localStorage persists across navigations in the same browser context,
    //    which is the real-world scenario for draft recovery (tab close/reopen,
    //    browser crash, or navigating away and returning).
    await gotoApp(sessionPage, '/pacientes');
    await expect(
      sessionPage.getByRole('heading', { name: 'Pacientes' }),
    ).toBeVisible({ timeout: 10_000 });

    // 8. Navigate back to the same encounter — draft should be recovered
    await gotoApp(sessionPage, `/atenciones/${encounterId}`);
    // The encounter page loads; navigate to Motivo de consulta if not already there
    await expect(
      sessionPage.getByRole('heading', { name: /identificación del paciente|motivo de consulta/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // If we landed on Identificación, navigate to Motivo de consulta
    const currentHeading = await sessionPage.getByRole('heading', { name: 'Identificación del paciente' }).isVisible().catch(() => false);
    if (currentHeading) {
      await sessionPage.getByRole('button', { name: /siguiente/i }).click();
    }
    await expect(sessionPage.getByRole('heading', { name: /Motivo de consulta/i })).toBeVisible({ timeout: 10_000 });

    const restoredMotivo = sessionPage.getByPlaceholder(
      'Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz...',
    );
    await expect(restoredMotivo).toHaveValue(draftNote);

    await sessionCtx.close();
  });
});
