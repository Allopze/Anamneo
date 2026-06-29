/**
 * Visual screenshot capture for UI/UX audit QA.
 *
 * Takes full-page screenshots of all key surfaces after login, for manual
 * review of spacing, empty states, skeletons, modals, and responsive layout.
 *
 * Output directory: tests/e2e/screenshots/
 * Run: npm --prefix frontend run test:e2e:visual
 *
 * Viewports captured per page:
 *   - desktop  1280 x 900
 *   - mobile   390 x 844   (iPhone 14 Pro)
 */

import * as path from 'path';
import * as fs from 'fs';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_NOMBRE,
  ADMIN_PASSWORD,
  BOOTSTRAP_TOKEN,
  MEDICO_EMAIL,
  MEDICO_PASSWORD,
} from './e2e-identities';
import { gotoApp } from './helpers/navigation';

// ── Output directory ──────────────────────────────────────────────────────────

const SHOTS_DIR = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

function shotPath(name: string) {
  return path.join(SHOTS_DIR, `${name}.png`);
}

async function shot(page: Page, name: string) {
  await page.locator('.skeleton').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await page.screenshot({ path: shotPath(name), fullPage: true });
}

async function dismissOptionalOnboarding(page: Page) {
  const exploreSolo = page.getByRole('button', { name: /Explorar solo/i });
  if (await exploreSolo.isVisible().catch(() => false)) {
    await exploreSolo.click();
    await expect(exploreSolo).toBeHidden({ timeout: 5_000 });
    return;
  }

  const closeButton = page.getByRole('button', { name: /Cerrar/i });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

async function waitForAppShell(page: Page) {
  // On desktop the sidebar nav is visible; on mobile it's collapsed behind the hamburger.
  // Use toBeAttached (present in DOM) as the auth signal so both viewports pass.
  await expect(
    page.locator('nav[aria-label="Navegación principal"]'),
  ).toBeAttached({ timeout: 20_000 });
}

async function waitForAuthenticatedPage(page: Page) {
  // Lighter check for mobile reloads: just ensure we didn't land on the login page.
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/login/);
}

async function loginViaUI(page: Page, email: string, password: string) {
  await gotoApp(page, '/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await waitForAppShell(page);
}

async function loginViaAPI(context: BrowserContext, page: Page, email: string, password: string) {
  const loginResp = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  if (!loginResp.ok()) return false;
  const cookies = loginResp.headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .flatMap((h) => {
      const parts = h.value.split(';')[0].split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (!name || !value) return [];
      return [{ name, value, domain: '127.0.0.1', path: '/' }];
    });
  if (cookies.length > 0) await context.addCookies(cookies);
  return true;
}

// ── Shared state (set up once via beforeAll) ───────────────────────────────────

let adminCookies: { name: string; value: string; domain: string; path: string }[] = [];
let medicoCookies: { name: string; value: string; domain: string; path: string }[] = [];
let samplePatientPath = '/pacientes';
let sampleEncounterPath = '';

// ── Setup ─────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Visual QA — screenshots', () => {
  test.beforeAll(async ({ browser, request }) => {
    test.setTimeout(120_000);

    // ── Bootstrap admin if needed ──────────────────────────────────────────────
    const bootstrapState = await (await request.get('/api/auth/bootstrap')).json() as { hasAdmin?: boolean };

    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const adminPage = await adminCtx.newPage();

    if (!bootstrapState.hasAdmin) {
      await gotoApp(adminPage, '/register');
      await adminPage.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
      await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
      await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
      await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
      await adminPage.getByLabel('Token de instalación').fill(BOOTSTRAP_TOKEN);
      await adminPage.getByRole('checkbox', { name: /Acepto/i }).check();
      await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
      await waitForAppShell(adminPage);
    } else {
      await loginViaUI(adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    }

    // Save admin cookies for reuse
    adminCookies = (await adminCtx.cookies()).map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
    }));

    // ── Create medico via invitation ───────────────────────────────────────────
    const inviteResp = await adminPage.request.post('/api/users/invitations', {
      data: { email: MEDICO_EMAIL, role: 'MEDICO' },
    });
    expect(inviteResp.ok(), await inviteResp.text()).toBeTruthy();
    if (inviteResp.ok()) {
      const { token: inviteToken } = await inviteResp.json() as { token: string };
      const medicoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const medicoPage = await medicoCtx.newPage();
      await gotoApp(medicoPage, `/register?token=${inviteToken}`);
      await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15_000 });
      await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba Visual');
      await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
      await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);
      await medicoPage.getByRole('checkbox', { name: /Acepto/i }).check();
      await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
      await waitForAppShell(medicoPage);

      const medicoLoginOk = await loginViaAPI(medicoCtx, medicoPage, MEDICO_EMAIL, MEDICO_PASSWORD);
      expect(medicoLoginOk).toBeTruthy();
      medicoCookies = (await medicoCtx.cookies()).map((c) => ({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
      }));

      const patientResp = await medicoPage.request.post('/api/patients', {
        data: {
          nombre: 'Paciente Visual E2E',
          fechaNacimiento: '1985-06-15',
          edad: 40,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
          rutExempt: true,
          rutExemptReason: 'Fixture de cobertura visual',
        },
      });
      expect(patientResp.ok(), await patientResp.text()).toBeTruthy();
      const patient = await patientResp.json() as { id: string };
      samplePatientPath = `/pacientes/${patient.id}`;
      await medicoCtx.close();
    }

    // ── Fallback sample patient for environments where medico setup is skipped ──
    if (samplePatientPath === '/pacientes') try {
      const patientResp = await adminPage.request.post('/api/patients', {
        data: {
          nombre: 'Paciente Visual E2E',
          fechaNacimiento: '1985-06-15',
          edad: 40,
          sexo: 'MASCULINO',
          prevision: 'FONASA',
          rutExempt: true,
          rutExemptReason: 'Fixture de cobertura visual',
        },
      });
      if (patientResp.ok()) {
        const patient = await patientResp.json() as { id: string };
        samplePatientPath = `/pacientes/${patient.id}`;
      }
    } catch { /* non-critical */ }

    await adminCtx.close();
  });

  // ── Public pages (unauthenticated) ──────────────────────────────────────────

  test('public: login page', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/login');
    await expect(page.getByRole('button', { name: /Iniciar sesión/i })).toBeVisible({ timeout: 10_000 });
    await shot(page, 'public__login--desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('button', { name: /Iniciar sesión/i })).toBeVisible({ timeout: 10_000 });
    await shot(page, 'public__login--mobile');
  });

  test('public: register page', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/register');
    await page.waitForLoadState('networkidle');
    await shot(page, 'public__register--desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await shot(page, 'public__register--mobile');
  });

  // ── Dashboard — admin ──────────────────────────────────────────────────────

  test('dashboard: admin view', async ({ browser }) => {
    test.setTimeout(40_000);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(adminCookies);
    await gotoApp(page, '/');
    await waitForAppShell(page);
    await page.waitForLoadState('networkidle');
    await shot(page, 'dashboard__admin--desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await waitForAuthenticatedPage(page);
    await shot(page, 'dashboard__admin--mobile');
    await ctx.close();
  });

  // ── Dashboard — medico ─────────────────────────────────────────────────────

  test('dashboard: medico view', async ({ browser }) => {
    test.setTimeout(40_000);
    if (medicoCookies.length === 0) test.skip(true, 'Medico cookies not set up');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(medicoCookies);
    await gotoApp(page, '/');
    await waitForAppShell(page);
    await page.waitForLoadState('networkidle');
    await dismissOptionalOnboarding(page);
    await shot(page, 'dashboard__medico--desktop');
    await ctx.close();
  });

  // ── Pacientes ──────────────────────────────────────────────────────────────

  test('pacientes: list', async ({ browser }) => {
    test.setTimeout(40_000);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(adminCookies);
    await gotoApp(page, '/pacientes');
    await page.waitForLoadState('networkidle');
    await shot(page, 'pacientes__list--desktop');
    await ctx.close();
  });

  test('pacientes: detail', async ({ browser }) => {
    test.setTimeout(40_000);
    if (medicoCookies.length === 0 || samplePatientPath === '/pacientes') {
      test.skip(true, 'Medico fixture patient not available');
    }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(medicoCookies);
    await gotoApp(page, samplePatientPath);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/pacientes\/[^/]+$/);
    await expect(page.getByText(/Paciente Visual E2E/i).first()).toBeVisible({ timeout: 10_000 });
    await shot(page, 'pacientes__detail--desktop');
    await ctx.close();
  });

  // ── Atenciones ─────────────────────────────────────────────────────────────

  test('atenciones: list', async ({ browser }) => {
    test.setTimeout(40_000);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(medicoCookies.length > 0 ? medicoCookies : adminCookies);
    await gotoApp(page, '/atenciones');
    await page.waitForLoadState('networkidle');
    await shot(page, 'atenciones__list--desktop');
    await ctx.close();
  });

  // ── Agenda ─────────────────────────────────────────────────────────────────

  test('agenda: week view', async ({ browser }) => {
    test.setTimeout(40_000);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(adminCookies);
    await gotoApp(page, '/agenda');
    await page.waitForLoadState('networkidle');
    await shot(page, 'agenda__week--desktop');
    await ctx.close();
  });

  // ── Admin surfaces ─────────────────────────────────────────────────────────

  test('admin: panel', async ({ browser }) => {
    test.setTimeout(40_000);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(adminCookies);
    await gotoApp(page, '/admin/usuarios');
    await page.waitForLoadState('networkidle');
    await shot(page, 'admin__usuarios--desktop');

    await gotoApp(page, '/admin/auditoria');
    await page.waitForLoadState('networkidle');
    await shot(page, 'admin__auditoria--desktop');

    await gotoApp(page, '/admin/solicitudes');
    await page.waitForLoadState('networkidle');
    await shot(page, 'admin__solicitudes--desktop');
    await ctx.close();
  });

  // ── Ajustes ────────────────────────────────────────────────────────────────

  test('ajustes: tabs', async ({ browser }) => {
    test.setTimeout(40_000);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(adminCookies);
    await gotoApp(page, '/ajustes');
    await page.waitForLoadState('networkidle');
    await shot(page, 'ajustes__perfil--desktop');

    // Sistema tab
    const sistemaTab = page.getByRole('tab', { name: /sistema/i });
    if (await sistemaTab.isVisible()) {
      await sistemaTab.click();
      await page.waitForLoadState('networkidle');
      await shot(page, 'ajustes__sistema--desktop');
    }
    await ctx.close();
  });

  // ── Analítica clínica ──────────────────────────────────────────────────────

  test('analitica: overview', async ({ browser }) => {
    test.setTimeout(40_000);
    if (medicoCookies.length === 0) test.skip(true, 'Medico cookies not set up');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await ctx.addCookies(medicoCookies);
    await gotoApp(page, '/analitica-clinica');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/analitica-clinica/);
    await expect(page.getByRole('heading', { name: /Analítica clínica/i })).toBeVisible({ timeout: 10_000 });
    await shot(page, 'analitica__overview--desktop');
    await ctx.close();
  });

  // ── Portal (paciente) ──────────────────────────────────────────────────────

  test('portal: login page', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/portal/login');
    await page.waitForLoadState('networkidle');
    await shot(page, 'portal__login--desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await shot(page, 'portal__login--mobile');
  });

  // ── Páginas públicas legales ───────────────────────────────────────────────

  test('legal: terminos + politica', async ({ page }) => {
    test.setTimeout(30_000);
    await gotoApp(page, '/terminos-y-condiciones');
    await page.waitForLoadState('networkidle');
    await shot(page, 'legal__terminos--desktop');

    await gotoApp(page, '/politica-de-privacidad');
    await page.waitForLoadState('networkidle');
    await shot(page, 'legal__privacidad--desktop');
  });

  // ── Descarga de ficha (URL pública) ───────────────────────────────────────

  test('public: descargar-ficha (unauthenticated state)', async ({ page }) => {
    test.setTimeout(20_000);
    await gotoApp(page, '/descargar-ficha');
    await page.waitForLoadState('networkidle');
    await shot(page, 'public__descargar-ficha--desktop');
  });

  // ── Error / Not found pages ────────────────────────────────────────────────

  test('global: not-found page', async ({ page }) => {
    test.setTimeout(20_000);
    await gotoApp(page, '/ruta-que-no-existe-visual-qa');
    await page.waitForLoadState('networkidle');
    await shot(page, 'global__not-found--desktop');
  });
});
