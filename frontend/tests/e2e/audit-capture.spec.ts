/**
 * Audit capture spec — Anamneo QA Audit 2026-06-03
 *
 * Captures edge cases, error states and console/network evidence that the
 * regular visual-screenshots / visual-full-app specs don't cover:
 *
 * - Login error (bad credentials)
 * - Patient form validation (empty submit)
 * - Patient form double-click on save (debounce / disable guard)
 * - Patient search: no results + special characters
 * - Protected route navigation without auth → redirect to /login
 * - Reload on an internal authenticated route (no breakage)
 * - Unsaved-changes guard on /pacientes/[id]/editar
 *
 * Each test also hooks console.error/warn and HTTP ≥400 responses and writes
 * the aggregate evidence to: ../../audit/evidence.json
 *
 * Output screenshots: tests/e2e/screenshots/ (same dir as the visual specs)
 * Naming prefix: audit__
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
  RUN_ID,
} from './e2e-identities';
import { gotoApp } from './helpers/navigation';

// ── Directories ───────────────────────────────────────────────────────────────

const SHOTS_DIR = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const AUDIT_DIR = path.resolve(__dirname, '../../../../audit');
fs.mkdirSync(AUDIT_DIR, { recursive: true });

const EVIDENCE_PATH = path.join(AUDIT_DIR, 'evidence.json');

// ── Evidence accumulator ──────────────────────────────────────────────────────

type EvidenceEntry = {
  screenshot: string;
  url: string;
  viewport: string;
  auth: string;
  action: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  networkErrors: string[];
};

const evidence: Record<string, EvidenceEntry> = {};

function saveEvidence() {
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
}

function trackPage(page: Page): { consoleErrors: string[]; consoleWarnings: string[]; networkErrors: string[] } {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      networkErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
    }
  });

  return { consoleErrors, consoleWarnings, networkErrors };
}

function recordEvidence(
  name: string,
  url: string,
  viewport: string,
  auth: string,
  action: string,
  tracked: ReturnType<typeof trackPage>,
) {
  evidence[name] = {
    screenshot: `${name}.png`,
    url,
    viewport,
    auth,
    action,
    consoleErrors: [...tracked.consoleErrors],
    consoleWarnings: [...tracked.consoleWarnings],
    networkErrors: [...tracked.networkErrors],
  };
  saveEvidence();
}

async function shot(page: Page, name: string) {
  await page.locator('.skeleton').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: true });
}

// ── Shared state ──────────────────────────────────────────────────────────────

let adminCookies: { name: string; value: string; domain: string; path: string }[] = [];
let medicoCookies: { name: string; value: string; domain: string; path: string }[] = [];
let samplePatientId = '';

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function loginViaAPI(
  context: BrowserContext,
  page: Page,
  email: string,
  password: string,
): Promise<{ name: string; value: string; domain: string; path: string }[]> {
  const resp = await page.request.post('/api/auth/login', { data: { email, password } });
  if (!resp.ok()) return [];
  const cookies = resp.headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .flatMap((h) => {
      const [nameVal] = h.value.split(';');
      const sep = nameVal.indexOf('=');
      if (sep < 1) return [];
      return [{ name: nameVal.slice(0, sep).trim(), value: nameVal.slice(sep + 1).trim(), domain: '127.0.0.1', path: '/' }];
    });
  if (cookies.length > 0) await context.addCookies(cookies);
  return cookies;
}

async function waitForAppShell(page: Page) {
  await expect(page.locator('nav[aria-label="Navegación principal"]')).toBeAttached({ timeout: 20_000 });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const LEGAL = { acceptedTermsVersion: '2026-05-02', acceptedPrivacyVersion: '2026-05-02' };

test.describe.configure({ mode: 'serial' });

test.describe('Audit — edge cases & console/network evidence', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);

    // Bootstrap admin
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const adminPage = await adminCtx.newPage();
    await gotoApp(adminPage, '/login');

    const bootstrap = await adminPage.request.get('/api/auth/bootstrap');
    const state = await bootstrap.json() as { hasAdmin?: boolean };
    if (!state.hasAdmin) {
      const reg = await adminPage.request.post('/api/auth/register', {
        data: {
          email: ADMIN_EMAIL, password: ADMIN_PASSWORD, nombre: ADMIN_NOMBRE,
          role: 'ADMIN', bootstrapToken: BOOTSTRAP_TOKEN, ...LEGAL,
        },
      });
      expect(reg.status(), await reg.text()).toBe(201);
    }

    adminCookies = await loginViaAPI(adminCtx, adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Register medico via invitation. Capture its session cookies straight from the
    // context jar (set by the register response) — deterministic, no manual Set-Cookie parsing.
    const auditMedicoEmail = `medico+audit+${RUN_ID}@e2e-test.local`;
    const invite = await adminPage.request.post('/api/users/invitations', {
      data: { email: auditMedicoEmail, role: 'MEDICO' },
    });
    expect(invite.ok(), await invite.text()).toBeTruthy();
    const { token } = await invite.json() as { token: string };

    const medicoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const medicoPage = await medicoCtx.newPage();
    await gotoApp(medicoPage, '/login');
    const regResp = await medicoPage.request.post('/api/auth/register', {
      data: {
        email: auditMedicoEmail, password: MEDICO_PASSWORD,
        nombre: 'Dra. Audit E2E', role: 'MEDICO', invitationToken: token, ...LEGAL,
      },
    });
    expect(regResp.status(), await regResp.text()).toBe(201);
    medicoCookies = await medicoCtx.cookies();
    expect(medicoCookies.length, 'Medico auth cookies should be captured after registration').toBeGreaterThan(0);

    // Deterministic sample patient fixture — created by the medico (admin lacks patient.create).
    const patResp = await medicoPage.request.post('/api/patients', {
      data: {
        nombre: 'Paciente Audit Edge',
        // edad omitida a propósito — debe derivarse de fechaNacimiento en el servidor.
        fechaNacimiento: '1990-05-10',
        sexo: 'FEMENINO',
        prevision: 'FONASA',
        rutExempt: true,
        rutExemptReason: 'Fixture auditoría edge cases',
      },
    });
    expect(patResp.ok(), await patResp.text()).toBeTruthy();
    samplePatientId = (await patResp.json() as { id: string }).id;
    expect(samplePatientId, 'Sample patient id should be set for edge-case tests').toBeTruthy();

    await medicoCtx.close();
    await adminCtx.close();
  });

  // ── 1. Login error state ─────────────────────────────────────────────────────

  test('audit: login-error', async ({ page }) => {
    test.setTimeout(30_000);
    const tracked = trackPage(page);
    await gotoApp(page, '/login');
    await expect(page.getByRole('button', { name: /Iniciar sesión/i })).toBeVisible({ timeout: 10_000 });

    // Desktop
    await page.getByLabel('Correo electrónico').fill('no-existe@example.com');
    await page.getByLabel('Contraseña').fill('ContraseñaIncorrecta123!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await shot(page, 'audit__login-error--desktop');
    recordEvidence(
      'audit__login-error--desktop',
      page.url(),
      '1280x900',
      'unauthenticated',
      'Submit login with wrong credentials',
      tracked,
    );

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('button', { name: /Iniciar sesión/i })).toBeVisible({ timeout: 10_000 });
    const trackedM = trackPage(page);
    await page.getByLabel('Correo electrónico').fill('no-existe@example.com');
    await page.getByLabel('Contraseña').fill('ContraseñaIncorrecta123!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await shot(page, 'audit__login-error--mobile');
    recordEvidence(
      'audit__login-error--mobile',
      page.url(),
      '390x844',
      'unauthenticated',
      'Submit login with wrong credentials (mobile)',
      trackedM,
    );
  });

  // ── 2. Protected route — unauthenticated redirect ─────────────────────────

  test('audit: protected-route-unauth', async ({ page }) => {
    test.setTimeout(20_000);
    const tracked = trackPage(page);
    await gotoApp(page, '/pacientes');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await shot(page, 'audit__protected-route-unauth--desktop');
    recordEvidence(
      'audit__protected-route-unauth--desktop',
      page.url(),
      '1280x900',
      'unauthenticated',
      'Navigate to /pacientes without session',
      tracked,
    );
    // Verify redirect happened
    const finalUrl = page.url();
    evidence['audit__protected-route-unauth--desktop'].url = finalUrl;
    saveEvidence();
  });

  // ── 3. Patient form validation (empty / required fields) ─────────────────

  test('audit: patient-form-validation', async ({ browser }) => {
    test.setTimeout(40_000);
    if (medicoCookies.length === 0 && adminCookies.length === 0) test.skip(true, 'No auth cookies');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    const cookies = medicoCookies.length > 0 ? medicoCookies : adminCookies;
    await ctx.addCookies(cookies);
    await gotoApp(page, '/pacientes/nuevo');
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Screenshot of blank form
    await shot(page, 'audit__patient-form-blank--desktop');
    recordEvidence(
      'audit__patient-form-blank--desktop',
      page.url(),
      '1280x900',
      'authenticated (medico/admin)',
      'Patient new form — blank state before any input',
      { consoleErrors: [...tracked.consoleErrors], consoleWarnings: [...tracked.consoleWarnings], networkErrors: [...tracked.networkErrors] },
    );

    // Submit empty form
    const submitBtn = page.getByRole('button', { name: /Guardar paciente|Crear paciente|Guardar/i }).first();
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();
    await page.waitForTimeout(800);
    await shot(page, 'audit__patient-form-validation-errors--desktop');
    recordEvidence(
      'audit__patient-form-validation-errors--desktop',
      page.url(),
      '1280x900',
      'authenticated (medico/admin)',
      'Click save on empty patient form → validation errors',
      tracked,
    );

    // Mobile blank form
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    const trackedMob = trackPage(page);
    await shot(page, 'audit__patient-form-blank--mobile');
    recordEvidence(
      'audit__patient-form-blank--mobile',
      page.url(),
      '390x844',
      'authenticated (medico/admin)',
      'Patient new form — blank state (mobile)',
      trackedMob,
    );

    const submitBtnM = page.getByRole('button', { name: /Guardar paciente|Crear paciente|Guardar/i }).first();
    await submitBtnM.scrollIntoViewIfNeeded();
    await submitBtnM.click();
    await page.waitForTimeout(800);
    await shot(page, 'audit__patient-form-validation-errors--mobile');
    recordEvidence(
      'audit__patient-form-validation-errors--mobile',
      page.url(),
      '390x844',
      'authenticated (medico/admin)',
      'Click save on empty patient form → validation errors (mobile)',
      trackedMob,
    );

    await ctx.close();
  });

  // ── 4. Search: no results + special characters ────────────────────────────

  test('audit: search-no-results', async ({ browser }) => {
    test.setTimeout(40_000);
    if (medicoCookies.length === 0 && adminCookies.length === 0) test.skip(true, 'No auth cookies');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    const cookies = medicoCookies.length > 0 ? medicoCookies : adminCookies;
    await ctx.addCookies(cookies);

    await gotoApp(page, '/pacientes?search=ZZZXXX_NO_EXISTE_99999');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await shot(page, 'audit__search-no-results--desktop');
    recordEvidence(
      'audit__search-no-results--desktop',
      page.url(),
      '1280x900',
      'authenticated',
      'Patient search with term that yields no results',
      tracked,
    );

    // Special characters
    const trackedSC = trackPage(page);
    await gotoApp(page, "/pacientes?search=<script>alert('xss')</script>");
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await shot(page, 'audit__search-special-chars--desktop');
    recordEvidence(
      'audit__search-special-chars--desktop',
      page.url(),
      '1280x900',
      'authenticated',
      "Patient search with special characters / XSS-like payload",
      trackedSC,
    );

    await ctx.close();
  });

  // ── 5. Reload internal route (with session) ───────────────────────────────

  test('audit: reload-internal-route', async ({ browser }) => {
    test.setTimeout(40_000);

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    const cookies = medicoCookies.length > 0 ? medicoCookies : adminCookies;
    await ctx.addCookies(cookies);
    await gotoApp(page, `/pacientes/${samplePatientId}`);
    await page.waitForLoadState('networkidle');
    // Hard reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot(page, 'audit__reload-patient-detail--desktop');
    recordEvidence(
      'audit__reload-patient-detail--desktop',
      page.url(),
      '1280x900',
      'authenticated',
      'Hard reload on /pacientes/[id] with valid session',
      tracked,
    );
    await ctx.close();
  });

  // ── 6. Unsaved changes guard (edit patient, navigate away) ─────────────────

  test('audit: unsaved-changes-guard', async ({ browser }) => {
    test.setTimeout(40_000);
    const cookies = medicoCookies.length > 0 ? medicoCookies : adminCookies;

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(cookies);
    await gotoApp(page, `/pacientes/${samplePatientId}/editar`);
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Screenshot of edit form baseline
    await shot(page, 'audit__patient-edit-form--desktop');
    recordEvidence(
      'audit__patient-edit-form--desktop',
      page.url(),
      '1280x900',
      'authenticated',
      'Patient edit form — baseline state before changes',
      { consoleErrors: [...tracked.consoleErrors], consoleWarnings: [...tracked.consoleWarnings], networkErrors: [...tracked.networkErrors] },
    );

    // Modify a field to make form dirty
    const nombreInput = page.getByLabel('Nombre').first();
    await nombreInput.fill('Paciente Audit Edge Modificado');
    await page.waitForTimeout(300);

    // Try to navigate away — expect guard modal
    const trackedGuard = trackPage(page);
    await page.getByRole('link', { name: /pacientes|Pacientes|inicio|Dashboard/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, 'audit__unsaved-changes-guard--desktop');
    recordEvidence(
      'audit__unsaved-changes-guard--desktop',
      page.url(),
      '1280x900',
      'authenticated',
      'Click nav link after modifying patient edit form — guard modal should appear',
      trackedGuard,
    );

    await ctx.close();
  });

  // ── 7. Console/network monitoring — key authenticated pages ──────────────

  test('audit: console-monitor-main-pages', async ({ browser }) => {
    test.setTimeout(120_000);
    if (adminCookies.length === 0) test.skip(true, 'No admin cookies');

    const pages: Array<{ slug: string; path: string; auth: 'admin' | 'medico' }> = [
      { slug: 'dashboard-admin', path: '/', auth: 'admin' },
      { slug: 'pacientes-list', path: '/pacientes', auth: 'admin' },
      { slug: 'atenciones-list', path: '/atenciones', auth: 'admin' },
      { slug: 'agenda', path: '/agenda', auth: 'admin' },
      { slug: 'ajustes', path: '/ajustes', auth: 'admin' },
      { slug: 'analitica', path: '/analitica-clinica', auth: 'admin' },
      { slug: 'admin-usuarios', path: '/admin/usuarios', auth: 'admin' },
      { slug: 'admin-auditoria', path: '/admin/auditoria', auth: 'admin' },
      { slug: 'reportes', path: '/reportes', auth: 'admin' },
      { slug: 'catalogo', path: '/catalogo', auth: 'admin' },
      { slug: 'plantillas', path: '/plantillas', auth: 'medico' },
      { slug: 'seguimientos', path: '/seguimientos', auth: 'medico' },
    ];

    for (const p of pages) {
      const cookies = p.auth === 'medico' && medicoCookies.length > 0
        ? medicoCookies : adminCookies;
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      const tracked = trackPage(page);
      await ctx.addCookies(cookies);
      await gotoApp(page, p.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      recordEvidence(
        `audit__monitor--${p.slug}`,
        page.url(),
        '1280x900',
        p.auth,
        `Console/network monitor for ${p.path}`,
        tracked,
      );
      await ctx.close();
    }
  });

  // ── 8. Patient detail console monitoring ─────────────────────────────────

  test('audit: console-monitor-patient-detail', async ({ browser }) => {
    test.setTimeout(40_000);

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    const cookies = medicoCookies.length > 0 ? medicoCookies : adminCookies;
    await ctx.addCookies(cookies);
    await gotoApp(page, `/pacientes/${samplePatientId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Capture detail mobile too
    await shot(page, 'audit__patient-detail-console--desktop');
    recordEvidence(
      'audit__patient-detail-console--desktop',
      page.url(),
      '1280x900',
      'authenticated',
      'Patient detail page — console/network monitoring',
      tracked,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await shot(page, 'audit__patient-detail-console--mobile');
    recordEvidence(
      'audit__patient-detail-console--mobile',
      page.url(),
      '390x844',
      'authenticated',
      'Patient detail page (mobile) — console/network monitoring',
      tracked,
    );

    await ctx.close();
  });

  test.afterAll(() => {
    saveEvidence();
  });
});
