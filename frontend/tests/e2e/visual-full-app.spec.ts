/**
 * Full app visual route coverage.
 *
 * Complements visual-screenshots.spec.ts by covering every remaining page.tsx
 * route with desktop and mobile screenshots where the route has a real page
 * state to render.
 */

import * as nodeFs from 'fs';
import * as path from 'path';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_NOMBRE,
  ADMIN_PASSWORD,
  BOOTSTRAP_TOKEN,
  MEDICO_PASSWORD,
  RUN_ID,
} from './e2e-identities';
import { gotoApp } from './helpers/navigation';

const SHOTS_DIR = path.resolve(__dirname, 'screenshots');
nodeFs.mkdirSync(SHOTS_DIR, { recursive: true });
const MEDICO_EMAIL = `medico+visual-full+${RUN_ID}@e2e-test.local`;
const PORTAL_EMAIL = `portal+visual-full+${RUN_ID}@e2e-test.local`;
const PORTAL_ACTIVATION_EMAIL = `portal-activar+visual-full+${RUN_ID}@e2e-test.local`;
const PORTAL_PASSWORD = 'PortalPass123!';
const LEGAL_ACCEPTANCE = {
  acceptedTermsVersion: '2026-05-02',
  acceptedPrivacyVersion: '2026-05-02',
};

type Cookie = Awaited<ReturnType<BrowserContext['cookies']>>[number];
type RouteCase = {
  name: string;
  path: () => string;
  cookies?: () => Cookie[];
  waitFor?: (page: Page) => Promise<void>;
};

let adminCookies: Cookie[] = [];
let medicoCookies: Cookie[] = [];
let portalCookies: Cookie[] = [];
let patientId = '';
let encounterId = '';
let conditionId = '';
let medicationId = '';
let portalActivationPath = '/portal/activar';

function shotPath(name: string) {
  return path.join(SHOTS_DIR, `${name}.png`);
}

async function shot(page: Page, name: string) {
  await page.locator('.skeleton').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await page.screenshot({ path: shotPath(name), fullPage: true });
}

async function waitForShell(page: Page) {
  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

async function waitForPublicPage(page: Page) {
  await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

async function waitForPortal(page: Page) {
  await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/portal\/login/);
}

async function loginViaApi(context: BrowserContext, page: Page, email: string, password: string) {
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  expect(response.ok(), `Login API should succeed for ${email}`).toBeTruthy();
  const baseUrl = new URL(page.url() || 'http://127.0.0.1:5556').origin;
  const cookies = response.headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .flatMap((header) => {
      const [nameValue] = header.value.split(';');
      const separator = nameValue.indexOf('=');
      if (separator < 1) return [];
      return [{
        name: nameValue.slice(0, separator),
        value: nameValue.slice(separator + 1),
        url: baseUrl,
        httpOnly: header.value.toLowerCase().includes('httponly'),
        sameSite: 'Strict' as const,
      }];
    });
  await context.addCookies(cookies);
  return context.cookies();
}

async function bootstrapAdmin(page: Page) {
  const bootstrap = await page.request.get('/api/auth/bootstrap');
  expect(bootstrap.ok()).toBeTruthy();
  const state = await bootstrap.json() as { hasAdmin?: boolean };
  if (!state.hasAdmin) {
    const response = await page.request.post('/api/auth/register', {
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        nombre: ADMIN_NOMBRE,
        role: 'ADMIN',
        bootstrapToken: BOOTSTRAP_TOKEN,
        ...LEGAL_ACCEPTANCE,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  }
}

async function registerMedico(adminPage: Page, browser: Browser) {
  const invite = await adminPage.request.post('/api/users/invitations', {
    data: { email: MEDICO_EMAIL, role: 'MEDICO' },
  });
  expect(invite.ok(), await invite.text()).toBeTruthy();
  const { token } = await invite.json() as { token: string };

  const medicoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const medicoPage = await medicoCtx.newPage();
  const registration = await medicoPage.request.post('/api/auth/register', {
    data: {
      email: MEDICO_EMAIL,
      password: MEDICO_PASSWORD,
      nombre: 'Dra. Visual Completa',
      role: 'MEDICO',
      invitationToken: token,
      ...LEGAL_ACCEPTANCE,
    },
  });
  expect(registration.status(), await registration.text()).toBe(201);
  await gotoApp(medicoPage, '/login');
  medicoCookies = await loginViaApi(medicoCtx, medicoPage, MEDICO_EMAIL, MEDICO_PASSWORD);
  await medicoCtx.close();
}

async function completeEncounter(page: Page, id: string) {
  const encounter = await page.request.get(`/api/encounters/${id}`);
  expect(encounter.ok(), await encounter.text()).toBeTruthy();
  const detail = await encounter.json() as { sections: Array<{ sectionKey: string; data: unknown }> };
  const identification = detail.sections.find((section) => section.sectionKey === 'IDENTIFICACION');
  expect(identification).toBeTruthy();

  const sectionPayloads = [
    ['IDENTIFICACION', identification!.data],
    ['MOTIVO_CONSULTA', { texto: 'Control visual de seguimiento clínico integral.' }],
    ['EXAMEN_FISICO', { abdomen: 'Abdomen blando, depresible, sin signos de irritación peritoneal.' }],
    ['SOSPECHA_DIAGNOSTICA', { sospechas: [{ id: 'dx-visual', diagnostico: 'Seguimiento clínico', notas: 'Fixture visual.' }] }],
    ['TRATAMIENTO', { plan: 'Mantener indicaciones y control según evolución.' }],
  ] as const;

  for (const [sectionKey, data] of sectionPayloads) {
    const response = await page.request.put(`/api/encounters/${id}/sections/${sectionKey}`, {
      data: { data, completed: true },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  await page.request.put(`/api/encounters/${id}/review-status`, {
    data: {
      reviewStatus: 'REVISADA_POR_MEDICO',
      note: 'Revisión médica suficiente para fixture visual de portal y ficha.',
    },
  });
  const completion = await page.request.post(`/api/encounters/${id}/complete`, {
    data: {
      closureNote: 'Atención finalizada para cobertura visual completa de ficha y portal paciente.',
    },
  });
  expect(completion.status(), await completion.text()).toBe(201);
}

async function setupClinicalFixtures(browser: Browser) {
  const medicoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await medicoCtx.addCookies(medicoCookies);
  const page = await medicoCtx.newPage();

  const patient = await page.request.post('/api/patients', {
    data: {
      nombre: 'Paciente Cobertura Visual',
      fechaNacimiento: '1984-01-20',
      edad: 42,
      sexo: 'FEMENINO',
      prevision: 'FONASA',
      rutExempt: true,
      rutExemptReason: 'Fixture de cobertura visual',
    },
  });
  expect(patient.status(), await patient.text()).toBe(201);
  patientId = ((await patient.json()) as { id: string }).id;

  const encounter = await page.request.post(`/api/encounters/patient/${patientId}`, { data: {} });
  expect(encounter.status(), await encounter.text()).toBe(201);
  encounterId = ((await encounter.json()) as { id: string }).id;
  await completeEncounter(page, encounterId);
  await medicoCtx.close();
}

async function setupCatalogFixtures(browser: Browser) {
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await adminCtx.addCookies(adminCookies);
  const page = await adminCtx.newPage();

  const condition = await page.request.post('/api/conditions', {
    data: { name: 'Afección visual E2E', synonyms: ['fixture visual'], tags: ['visual'] },
  });
  expect(condition.status(), await condition.text()).toBe(201);
  conditionId = ((await condition.json()) as { id: string }).id;

  const medication = await page.request.post('/api/medications', {
    data: {
      name: 'Medicamento visual E2E',
      activeIngredient: 'principio visual',
      defaultDose: '500 mg',
      defaultRoute: 'ORAL',
      defaultFrequency: 'cada 8 h',
    },
  });
  expect(medication.status(), await medication.text()).toBe(201);
  medicationId = ((await medication.json()) as { id: string }).id;
  await adminCtx.close();
}

async function setupPortalFixtures(browser: Browser) {
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await adminCtx.addCookies(adminCookies);
  const adminPage = await adminCtx.newPage();

  const invite = await adminPage.request.post(`/api/admin/patients/${patientId}/portal-invite`, {
    data: { email: PORTAL_EMAIL, relationship: 'TITULAR' },
  });
  expect(invite.status(), await invite.text()).toBe(201);
  const { activationUrl } = await invite.json() as { activationUrl: string };

  const activationInvite = await adminPage.request.post(`/api/admin/patients/${patientId}/portal-invite`, {
    data: { email: PORTAL_ACTIVATION_EMAIL, relationship: 'REPRESENTANTE' },
  });
  expect(activationInvite.status(), await activationInvite.text()).toBe(201);
  const activationFixture = await activationInvite.json() as { activationUrl: string };
  const activationUrlParsed = new URL(activationFixture.activationUrl);
  portalActivationPath = `${activationUrlParsed.pathname}${activationUrlParsed.search}`;
  await adminCtx.close();

  const portalCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const portalPage = await portalCtx.newPage();
  const url = new URL(activationUrl);
  await gotoApp(portalPage, `${url.pathname}${url.search}`);
  await expect(portalPage.getByRole('heading', { name: /activar portal paciente/i })).toBeVisible({ timeout: 15_000 });
  await portalPage.getByLabel('Contraseña').fill(PORTAL_PASSWORD);
  await portalPage.getByLabel(/política de privacidad/i).check();
  await portalPage.getByLabel(/términos y condiciones/i).check();
  await portalPage.getByRole('button', { name: /activar cuenta/i }).click();
  await expect(portalPage).toHaveURL(/\/portal$/, { timeout: 20_000 });
  portalCookies = await portalCtx.cookies();
  await portalCtx.close();
}

async function captureRoute(browser: Browser, route: RouteCase) {
  for (const viewport of [
    { suffix: 'desktop', width: 1280, height: 900 },
    { suffix: 'mobile', width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await ctx.newPage();
    const cookies = route.cookies?.() ?? [];
    if (cookies.length > 0) await ctx.addCookies(cookies);
    await gotoApp(page, route.path());
    await (route.waitFor ?? waitForShell)(page);
    await shot(page, `${route.name}--${viewport.suffix}`);
    await ctx.close();
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Visual QA — full app route coverage', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const adminPage = await adminCtx.newPage();
    await gotoApp(adminPage, '/login');
    await bootstrapAdmin(adminPage);
    adminCookies = await loginViaApi(adminCtx, adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);
    await registerMedico(adminPage, browser);
    await adminCtx.close();

    await setupClinicalFixtures(browser);
    await setupCatalogFixtures(browser);
    await setupPortalFixtures(browser);
  });

  const routes: RouteCase[] = [
    { name: 'public__forgot-password', path: () => '/forgot-password', waitFor: waitForPublicPage },
    { name: 'public__derechos', path: () => '/derechos', waitFor: waitForPublicPage },
    { name: 'public__change-password-invalid-token', path: () => `/cambiar-contrasena?token=${'a'.repeat(32)}`, waitFor: waitForPublicPage },
    { name: 'portal__activar', path: () => portalActivationPath, waitFor: waitForPublicPage },
    { name: 'portal__login-reset', path: () => `/portal/login?resetToken=${'b'.repeat(32)}`, waitFor: waitForPublicPage },
    { name: 'pacientes__new', path: () => '/pacientes/nuevo', cookies: () => medicoCookies },
    { name: 'pacientes__edit', path: () => `/pacientes/${patientId}/editar`, cookies: () => medicoCookies },
    { name: 'pacientes__history', path: () => `/pacientes/${patientId}/historial`, cookies: () => medicoCookies },
    { name: 'pacientes__admin', path: () => `/pacientes/${patientId}/administrativo`, cookies: () => adminCookies },
    { name: 'atenciones__new', path: () => '/atenciones/nueva', cookies: () => medicoCookies },
    { name: 'atenciones__detail', path: () => `/atenciones/${encounterId}`, cookies: () => medicoCookies },
    { name: 'atenciones__ficha', path: () => `/atenciones/${encounterId}/ficha`, cookies: () => medicoCookies },
    { name: 'plantillas__list', path: () => '/plantillas', cookies: () => medicoCookies },
    { name: 'seguimientos__list', path: () => '/seguimientos', cookies: () => medicoCookies },
    { name: 'reportes__list', path: () => '/reportes', cookies: () => adminCookies },
    { name: 'analitica__casos', path: () => '/analitica-clinica/casos', cookies: () => medicoCookies },
    { name: 'catalogo__afecciones', path: () => '/catalogo', cookies: () => adminCookies },
    { name: 'catalogo__medicamentos', path: () => '/catalogo?categoria=medicamentos', cookies: () => adminCookies },
    { name: 'catalogo__afeccion-new', path: () => '/catalogo/nueva', cookies: () => adminCookies },
    { name: 'catalogo__afeccion-edit', path: () => `/catalogo/${conditionId}`, cookies: () => adminCookies },
    { name: 'catalogo__medicamento-new', path: () => '/catalogo/medicamentos/nueva', cookies: () => adminCookies },
    { name: 'catalogo__medicamento-edit', path: () => `/catalogo/medicamentos/${medicationId}`, cookies: () => adminCookies },
    { name: 'portal__home', path: () => '/portal', cookies: () => portalCookies, waitFor: waitForPortal },
    { name: 'portal__solicitudes', path: () => '/portal/solicitudes', cookies: () => portalCookies, waitFor: waitForPortal },
    { name: 'portal__historial-acceso', path: () => '/portal/historial-acceso', cookies: () => portalCookies, waitFor: waitForPortal },
    { name: 'portal__atencion-detail', path: () => `/portal/atenciones/${encounterId}`, cookies: () => portalCookies, waitFor: waitForPortal },
  ];

  for (const route of routes) {
    test(`${route.name} desktop + mobile`, async ({ browser }) => {
      test.setTimeout(60_000);
      await captureRoute(browser, route);
    });
  }
});
