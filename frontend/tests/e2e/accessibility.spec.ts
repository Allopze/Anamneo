import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN, MEDICO_PASSWORD, RUN_ID } from './e2e-identities';
import { gotoApp } from './helpers/navigation';

const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/politica-de-privacidad',
  '/terminos-y-condiciones',
] as const;

const MEDICO_EMAIL = `medico+a11y+${RUN_ID}@e2e-test.local`;
const TEST_LEGAL_ACCEPTANCE = {
  acceptedTermsVersion: '2026-05-02',
  acceptedPrivacyVersion: '2026-05-02',
};

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' });

async function waitForRouteReady(page: Page, route: string) {
  if (route === '/login' || route === '/forgot-password') {
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    return;
  }

  if (route === '/') {
    await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
    return;
  }

  if (['/pacientes', '/atenciones', '/seguimientos', '/plantillas', '/catalogo', '/ajustes'].includes(route)) {
    await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
    return;
  }

  if (route.startsWith('/pacientes/') && route !== '/pacientes/nuevo') {
    await expect(page.getByRole('heading', { name: /paciente accesibilidad/i })).toBeVisible({ timeout: 15000 });
    return;
  }

  await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
}

async function expectNoCriticalA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const actionableViolations = results.violations.filter((violation) =>
    ['critical', 'serious'].includes(violation.impact || ''),
  );

  expect(actionableViolations).toEqual([]);
}

test.describe('Accessibility gate', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.use({ viewport: { width: 1280, height: 900 } });

  let patientId = '';

  test.beforeAll(async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    const bootstrapResp = await adminPage.request.get('/api/auth/bootstrap');
    expect(bootstrapResp.ok(), 'Bootstrap status request should succeed').toBeTruthy();
    const bootstrapState = (await bootstrapResp.json()) as { hasAdmin?: boolean };

    if (!bootstrapState.hasAdmin) {
      const registerResp = await adminPage.request.post('/api/auth/register', {
        data: {
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          nombre: ADMIN_NOMBRE,
          role: 'ADMIN',
          bootstrapToken: BOOTSTRAP_TOKEN,
          ...TEST_LEGAL_ACCEPTANCE,
        },
      });
      expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
    } else {
      const loginResp = await adminPage.request.post('/api/auth/login', {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      });
      expect(loginResp.ok(), 'Admin API login should succeed').toBeTruthy();
    }

    const inviteResp = await adminPage.request.post('/api/users/invitations', {
      data: { email: MEDICO_EMAIL, role: 'MEDICO' },
    });
    expect(inviteResp.ok(), 'Medico invitation should succeed').toBeTruthy();
    const { token: inviteToken } = await inviteResp.json();
    await adminCtx.close();

    const medicoCtx = await browser.newContext();
    const medicoPage = await medicoCtx.newPage();
    const medicoRegResp = await medicoPage.request.post('/api/auth/register', {
      data: {
        email: MEDICO_EMAIL,
        password: MEDICO_PASSWORD,
        nombre: 'Dra. Accesibilidad E2E',
        role: 'MEDICO',
        invitationToken: inviteToken,
        ...TEST_LEGAL_ACCEPTANCE,
      },
    });
    expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);

    const patientResp = await medicoPage.request.post('/api/patients', {
      data: {
        nombre: 'Paciente Accesibilidad',
        fechaNacimiento: '1978-03-12',
        edad: 48,
        sexo: 'FEMENINO',
        prevision: 'FONASA',
      },
    });
    expect(patientResp.ok(), 'A11y patient fixture should be created').toBeTruthy();
    patientId = ((await patientResp.json()) as { id: string }).id;
    await medicoCtx.close();
  });

  async function loginAsMedico(page: Page) {
    await gotoApp(page, '/login');
    const appUrl = new URL(page.url()).origin;
    const loginResp = await page.request.post('/api/auth/login', {
      data: { email: MEDICO_EMAIL, password: MEDICO_PASSWORD },
    });
    expect(loginResp.ok(), 'Medico API login should succeed').toBeTruthy();
    const authCookies = loginResp.headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => {
        const [nameValue] = header.value.split(';');
        const separatorIndex = nameValue.indexOf('=');
        return {
          name: nameValue.slice(0, separatorIndex),
          value: nameValue.slice(separatorIndex + 1),
          url: appUrl,
          httpOnly: header.value.toLowerCase().includes('httponly'),
          sameSite: 'Strict' as const,
        };
      })
      .filter((cookie) => cookie.name && cookie.value);

    expect(authCookies.length, 'Login should return auth cookies').toBeGreaterThanOrEqual(2);
    await page.context().addCookies(authCookies);
    await expect.poll(async () => (await page.request.get('/api/auth/me')).ok(), {
      message: 'Medico auth cookies should authorize /api/auth/me',
      timeout: 10000,
    }).toBe(true);
  }

  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no serious automated axe violations`, async ({ page }) => {
      await gotoApp(page, route);
      await waitForRouteReady(page, route);
      await expectNoCriticalA11yViolations(page);
    });
  }

  test('authenticated routes have no serious automated axe violations', async ({ page }) => {
    test.setTimeout(120_000);
    const authenticatedRoutes = [
      '/',
      '/pacientes',
      '/pacientes/nuevo',
      `/pacientes/${patientId}`,
      '/atenciones',
      '/seguimientos',
      '/plantillas',
      '/catalogo',
      '/ajustes',
    ];

    await loginAsMedico(page);
    for (const route of authenticatedRoutes) {
      await gotoApp(page, route);
      await waitForRouteReady(page, route);
      await expectNoCriticalA11yViolations(page);
    }
  });

  test('authenticated shell exposes keyboard focus on primary navigation and content actions', async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsMedico(page);
    await gotoApp(page, '/pacientes');
    await waitForRouteReady(page, '/pacientes');

    const visitedFocusTargets: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      const activeTarget = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body) return '';
        const label = active.getAttribute('aria-label') || active.innerText || active.getAttribute('href') || '';
        return `${active.tagName.toLowerCase()}:${label.trim().slice(0, 40)}`;
      });
      if (activeTarget) visitedFocusTargets.push(activeTarget);
    }

    expect(new Set(visitedFocusTargets).size).toBeGreaterThanOrEqual(3);
  });
});
