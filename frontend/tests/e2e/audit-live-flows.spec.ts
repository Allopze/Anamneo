/**
 * audit-live-flows.spec.ts — Anamneo QA Audit 2026-06-03
 *
 * Verifies end-to-end functional flows for key CRUD operations:
 * - Patient: create → persist → reload → edit → persist → archive (confirm dialog)
 * - Encounter: create → fill sections → save → reload → persist check
 * - Navigation: back-button after edit, direct route without auth
 * - Edge cases: duplicate submit, unsaved-changes guard, long text fields
 *
 * Evidence written to: ../../audit/evidence-live.json
 * Screenshots saved to: tests/e2e/screenshots/ (prefix: live__)
 */

import * as path from 'path';
import * as fs from 'fs';
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_NOMBRE,
  ADMIN_PASSWORD,
  BOOTSTRAP_TOKEN,
  MEDICO_PASSWORD,
  RUN_ID,
} from './e2e-identities';
import { gotoApp } from './helpers/navigation';

// ── Directories ────────────────────────────────────────────────────────────────

const SHOTS_DIR = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

const AUDIT_DIR = path.resolve(__dirname, '../../../../audit');
fs.mkdirSync(AUDIT_DIR, { recursive: true });

const EVIDENCE_LIVE_PATH = path.join(AUDIT_DIR, 'evidence-live.json');

// ── Evidence accumulator ───────────────────────────────────────────────────────

type LiveEntry = {
  screenshot: string | null;
  url: string;
  viewport: string;
  auth: string;
  action: string;
  result: 'PASS' | 'FAIL' | 'SKIP' | 'INFO';
  notes: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  networkErrors: string[];
};

const live: Record<string, LiveEntry> = {};

function saveLive() {
  fs.writeFileSync(EVIDENCE_LIVE_PATH, JSON.stringify(live, null, 2));
}

function trackPage(page: Page) {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const networkErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`[pageerror] ${err.message}`));
  page.on('response', (resp) => {
    if (resp.status() >= 400) networkErrors.push(`${resp.status()} ${resp.request().method()} ${resp.url()}`);
  });
  return { consoleErrors, consoleWarnings, networkErrors };
}

function record(
  name: string,
  result: LiveEntry['result'],
  action: string,
  notes: string,
  url: string,
  viewport: string,
  auth: string,
  tracked: ReturnType<typeof trackPage>,
  screenshot: string | null = null,
) {
  live[name] = {
    screenshot,
    url,
    viewport,
    auth,
    action,
    result,
    notes,
    consoleErrors: [...tracked.consoleErrors],
    consoleWarnings: [...tracked.consoleWarnings],
    networkErrors: [...tracked.networkErrors],
  };
  saveLive();
}

async function shot(page: Page, name: string): Promise<string> {
  await page.locator('.skeleton').first().waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  const filePath = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return `${name}.png`;
}

// ── Shared state ───────────────────────────────────────────────────────────────

let medicoCookies: { name: string; value: string; domain: string; path: string }[] = [];
let samplePatientId = '';
let sampleEncounterId = '';
const MEDICO_EMAIL_LIVE = `medico+live+${RUN_ID}@e2e-test.local`;

const LEGAL = { acceptedTermsVersion: '2026-05-02', acceptedPrivacyVersion: '2026-05-02' };

const LONG_TEXT = 'Texto clínico muy largo: '.repeat(30).trim();

async function loginViaAPI(
  context: BrowserContext,
  page: Page,
  email: string,
  password: string,
) {
  const resp = await page.request.post('/api/auth/login', { data: { email, password } });
  if (!resp.ok()) return [];
  const cookies = resp.headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .flatMap((h) => {
      const [nameVal] = h.value.split(';');
      const sep = nameVal.indexOf('=');
      if (sep < 1) return [];
      return [{
        name: nameVal.slice(0, sep).trim(),
        value: nameVal.slice(sep + 1).trim(),
        domain: '127.0.0.1',
        path: '/',
      }];
    });
  if (cookies.length > 0) await context.addCookies(cookies);
  return cookies;
}

// ── Setup ──────────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Audit — live functional flows', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);

    // 1. Bootstrap admin
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const adminPage = await adminCtx.newPage();
    await gotoApp(adminPage, '/login');

    const bootstrap = await adminPage.request.get('/api/auth/bootstrap');
    const state = await bootstrap.json() as { hasAdmin?: boolean };
    if (!state.hasAdmin) {
      await adminPage.request.post('/api/auth/register', {
        data: {
          email: ADMIN_EMAIL, password: ADMIN_PASSWORD, nombre: ADMIN_NOMBRE,
          role: 'ADMIN', bootstrapToken: BOOTSTRAP_TOKEN, ...LEGAL,
        },
      });
    }
    const adminCookies = await loginViaAPI(adminCtx, adminPage, ADMIN_EMAIL, ADMIN_PASSWORD);

    // 2. Register medico via invitation (MEDICO is needed for patient.create)
    const invite = await adminPage.request.post('/api/users/invitations', {
      data: { email: MEDICO_EMAIL_LIVE, role: 'MEDICO' },
    });
    if (invite.ok()) {
      const { token } = await invite.json() as { token: string };
      const medicoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const medicoPage = await medicoCtx.newPage();
      const regResp = await medicoPage.request.post('/api/auth/register', {
        data: {
          email: MEDICO_EMAIL_LIVE, password: MEDICO_PASSWORD,
          nombre: 'Dra. Live E2E', role: 'MEDICO', invitationToken: token, ...LEGAL,
        },
      });
      if (regResp.status() === 201) {
        medicoCookies = await loginViaAPI(medicoCtx, medicoPage, MEDICO_EMAIL_LIVE, MEDICO_PASSWORD);
      }
      await medicoCtx.close();
    }

    // 3. Create sample patient using MEDICO cookies (admin lacks patient.create)
    if (medicoCookies.length > 0) {
      const medicoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await medicoCtx.addCookies(medicoCookies);
      const apiPage = await medicoCtx.newPage();
      await gotoApp(apiPage, '/login');
      const patResp = await apiPage.request.post('/api/patients', {
        data: {
          nombre: 'María Test Auditora',
          fechaNacimiento: '1990-05-10',
          sexo: 'FEMENINO',
          prevision: 'FONASA',
          rutExempt: true,
          rutExemptReason: 'Fixture auditoría live flows',
        },
      });
      if (patResp.ok()) {
        const p = await patResp.json() as { id: string };
        samplePatientId = p.id;
      }
      await medicoCtx.close();
    }

    // 4. Create sample encounter via API for later tests
    if (medicoCookies.length > 0 && samplePatientId) {
      const medicoCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await medicoCtx.addCookies(medicoCookies);
      const apiPage = await medicoCtx.newPage();
      await gotoApp(apiPage, '/login');
      const encResp = await apiPage.request.post('/api/encounters', {
        data: { patientId: samplePatientId },
      });
      if (encResp.ok()) {
        const e = await encResp.json() as { id: string };
        sampleEncounterId = e.id;
      }
      await medicoCtx.close();
    }

    await adminCtx.close();
  });

  // ── PATIENT FLOWS ─────────────────────────────────────────────────────────────

  test('live: patient-detail-reload-persists', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0 || !samplePatientId) test.skip(true, 'No medico or patient');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/pacientes/${samplePatientId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await shot(page, 'live__patient-detail-first-load--desktop');

    // Hard reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const hasContent = await page.locator('h1, h2, [class*="patient"], main').first().isVisible().catch(() => false);
    const noAuthError = !page.url().includes('/login');

    await shot(page, 'live__patient-detail-after-reload--desktop');
    record('live__patient-detail-reload',
      (hasContent && noAuthError) ? 'PASS' : 'FAIL',
      'Hard reload /pacientes/[id] — page should recover without auth error',
      (hasContent && noAuthError)
        ? 'Page rendered after reload, session maintained'
        : `Problems after reload. URL: ${page.url()}. Errors: ${tracked.consoleErrors.join('; ')}`,
      page.url(), '1280x900', 'medico',
      tracked, 'live__patient-detail-after-reload--desktop.png'
    );

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await shot(page, 'live__patient-detail-mobile--desktop');
    record('live__patient-detail-mobile', 'INFO',
      'Patient detail page on mobile after reload',
      'Mobile layout check — see screenshot',
      page.url(), '390x844', 'medico',
      tracked, 'live__patient-detail-mobile--desktop.png'
    );

    await ctx.close();
  });

  test('live: patient-edit-persist', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0 || !samplePatientId) test.skip(true, 'No medico or patient');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/pacientes/${samplePatientId}/editar`);
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await shot(page, 'live__patient-edit-form--desktop');

    // Edit centroMedico field if present
    const centroInput = page.locator('input[name="centroMedico"]').first();
    if (await centroInput.isVisible().catch(() => false)) {
      await centroInput.clear();
      await centroInput.fill('Centro Médico Auditado');
    }

    const submitBtn = page.getByRole('button', { name: /Guardar|Actualizar/i }).first();
    await submitBtn.click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const afterUrl = page.url();
    const savedOk = !afterUrl.includes('/editar') ||
      await page.locator('[role="alert"], [class*="success"], [class*="toast"]').isVisible().catch(() => false);

    await shot(page, 'live__patient-edit-saved--desktop');
    record('live__patient-edit-persist',
      savedOk ? 'PASS' : 'FAIL',
      'Edit patient and save — check redirect or success feedback',
      savedOk
        ? `Saved. Redirected to: ${afterUrl}`
        : `Still on edit or no success feedback. URL: ${afterUrl}. Errors: ${tracked.consoleErrors.join('; ')}`,
      afterUrl, '1280x900', 'medico',
      tracked, 'live__patient-edit-saved--desktop.png'
    );

    await ctx.close();
  });

  test('live: patient-unsaved-changes-guard', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0 || !samplePatientId) test.skip(true, 'No medico or patient');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/pacientes/${samplePatientId}/editar`);
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    // Make form dirty
    const firstText = page.locator('input[type="text"]:not([disabled]):not([readonly])').first();
    const orig = await firstText.inputValue().catch(() => '');
    await firstText.fill(orig + ' DIRTY').catch(() => {});
    await page.waitForTimeout(300);

    // Try to navigate away
    await page.locator('nav a, aside a, [role="navigation"] a').first().click().catch(async () => {
      await page.goBack().catch(() => {});
    });
    await page.waitForTimeout(800);

    const guardVisible = await page.locator('[role="dialog"], [role="alertdialog"]').isVisible().catch(() => false);
    const urlChanged = !page.url().includes('/editar');

    await shot(page, 'live__unsaved-changes-guard--desktop');
    record('live__unsaved-changes-guard',
      guardVisible ? 'PASS' : (urlChanged ? 'FAIL' : 'INFO'),
      'Navigate away from dirty edit form — expect guard dialog',
      guardVisible
        ? 'Guard dialog appeared — unsaved changes protection works'
        : urlChanged
          ? 'FAIL: navigated away without confirmation guard'
          : 'Form may not have registered as dirty — no guard and no navigation',
      page.url(), '1280x900', 'medico',
      tracked, 'live__unsaved-changes-guard--desktop.png'
    );

    await ctx.close();
  });

  test('live: patient-archive-requires-confirmation', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0 || !samplePatientId) test.skip(true, 'No medico or patient');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/pacientes/${samplePatientId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Archive button may be inside a menu
    const moreBtn = page.getByRole('button', { name: /más opciones|acciones|⋮|\.\.\.|\.\.\./i }).first();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(300);
    }

    const archiveBtn = page.getByRole('button', { name: /archivar|eliminar/i })
      .or(page.getByRole('menuitem', { name: /archivar|eliminar/i })).first();
    const btnVisible = await archiveBtn.isVisible().catch(() => false);

    if (btnVisible) {
      await archiveBtn.click();
      await page.waitForTimeout(600);
      const confirmDialog = await page.locator('[role="dialog"], [role="alertdialog"]').isVisible().catch(() => false);
      await shot(page, 'live__patient-archive-confirm--desktop');
      record('live__patient-archive-confirm',
        confirmDialog ? 'PASS' : 'FAIL',
        'Click archive patient — expect confirmation dialog',
        confirmDialog
          ? 'Confirmation dialog appeared before destructive action'
          : 'No confirmation dialog — archive may execute immediately (destructive without confirm)',
        page.url(), '1280x900', 'medico',
        tracked, 'live__patient-archive-confirm--desktop.png'
      );
      await page.keyboard.press('Escape');
    } else {
      await shot(page, 'live__patient-archive-no-btn--desktop');
      record('live__patient-archive-confirm', 'INFO',
        'Archive button not found on patient detail page',
        'Button not visible from this role/state — may be in nested menu or require scroll',
        page.url(), '1280x900', 'medico',
        tracked, 'live__patient-archive-no-btn--desktop.png'
      );
    }

    await ctx.close();
  });

  // ── ENCOUNTER FLOWS ───────────────────────────────────────────────────────────

  test('live: encounter-detail-reload', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0 || !sampleEncounterId) test.skip(true, 'No encounter');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/atenciones/${sampleEncounterId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await shot(page, 'live__encounter-detail--desktop');

    // Hard reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const noError = !page.url().includes('/login') && !page.url().includes('/404');
    await shot(page, 'live__encounter-reload--desktop');
    record('live__encounter-reload',
      noError ? 'PASS' : 'FAIL',
      'Hard reload on /atenciones/[id] — no auth error',
      noError ? 'Encounter page survived reload' : `Unexpected redirect: ${page.url()}`,
      page.url(), '1280x900', 'medico',
      tracked, 'live__encounter-reload--desktop.png'
    );

    await ctx.close();
  });

  test('live: encounter-section-save-and-reload', async ({ browser }) => {
    test.setTimeout(90_000);
    if (medicoCookies.length === 0 || !sampleEncounterId) test.skip(true, 'No encounter');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/atenciones/${sampleEncounterId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to find and fill a text area (any section)
    const textArea = page.locator('textarea').first();
    if (await textArea.isVisible().catch(() => false)) {
      await textArea.fill('Cefalea persistente de 3 días de evolución. Paciente refiere intensidad 7/10.');
      await page.waitForTimeout(300);

      const saveBtn = page.getByRole('button', { name: /Guardar|Actualizar/i }).first();
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        await page.waitForLoadState('networkidle');
        await shot(page, 'live__encounter-section-saved--desktop');

        // Reload and verify
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        const textVisible = await page.getByText('Cefalea persistente').isVisible().catch(() => false);
        await shot(page, 'live__encounter-reload-persist--desktop');
        record('live__encounter-section-persist',
          textVisible ? 'PASS' : 'FAIL',
          'Fill encounter section, save, reload — check text persists',
          textVisible
            ? 'Section content persists after reload'
            : 'Section content NOT found after reload — may not be saving correctly',
          page.url(), '1280x900', 'medico',
          tracked, 'live__encounter-reload-persist--desktop.png'
        );
      } else {
        record('live__encounter-section-persist', 'INFO',
          'No save button found in encounter section', 'May use autosave',
          page.url(), '1280x900', 'medico', tracked
        );
      }
    } else {
      await shot(page, 'live__encounter-no-textarea--desktop');
      record('live__encounter-section-persist', 'INFO',
        'No textarea visible in encounter — sections may need expand first',
        'Manual verification needed',
        page.url(), '1280x900', 'medico',
        tracked, 'live__encounter-no-textarea--desktop.png'
      );
    }

    await ctx.close();
  });

  test('live: encounter-long-text', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0 || !sampleEncounterId) test.skip(true, 'No encounter');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/atenciones/${sampleEncounterId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const textArea = page.locator('textarea').first();
    if (await textArea.isVisible().catch(() => false)) {
      await textArea.fill(LONG_TEXT);
      await page.waitForTimeout(300);
      await shot(page, 'live__encounter-long-text--desktop');
      record('live__encounter-long-text', 'INFO',
        'Fill encounter text area with very long text — check visual overflow',
        'See screenshot for overflow/truncation issues',
        page.url(), '1280x900', 'medico',
        tracked, 'live__encounter-long-text--desktop.png'
      );
    } else {
      record('live__encounter-long-text', 'SKIP', 'No textarea', '', page.url(), '1280x900', 'medico', tracked);
    }

    await ctx.close();
  });

  // ── NAVIGATION / SECURITY ─────────────────────────────────────────────────────

  test('live: protected-routes-without-auth', async ({ browser }) => {
    test.setTimeout(40_000);

    const routes = [
      '/pacientes', '/atenciones', '/agenda',
      '/admin/usuarios', '/admin/auditoria', '/ajustes',
    ];

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);

    for (const route of routes) {
      await gotoApp(page, route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      const finalUrl = page.url();
      const redirected = finalUrl.includes('/login');
      record(`live__protected${route.replace(/\//g, '-')}`,
        redirected ? 'PASS' : 'FAIL',
        `Direct navigation to ${route} without session`,
        redirected
          ? `Redirected to login: ${finalUrl}`
          : `NOT redirected — arrived at: ${finalUrl}`,
        finalUrl, '1280x900', 'unauthenticated', tracked
      );
    }

    await ctx.close();
  });

  test('live: browser-back-after-edit', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0 || !samplePatientId) test.skip(true, 'No medico or patient');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, `/pacientes/${samplePatientId}`);
    await page.waitForLoadState('networkidle');

    await gotoApp(page, `/pacientes/${samplePatientId}/editar`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);

    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);

    const backUrl = page.url();
    const backOk = backUrl.includes('/pacientes/') && !backUrl.includes('/editar');
    await shot(page, 'live__back-after-edit--desktop');
    record('live__browser-back-after-edit',
      backOk ? 'PASS' : 'FAIL',
      'Press browser back after navigating to edit — should return to detail',
      backOk ? `Returned to: ${backUrl}` : `Unexpected URL: ${backUrl}`,
      backUrl, '1280x900', 'medico',
      tracked, 'live__back-after-edit--desktop.png'
    );

    await ctx.close();
  });

  test('live: double-click-save-debounce', async ({ browser }) => {
    test.setTimeout(60_000);
    if (medicoCookies.length === 0) test.skip(true, 'No medico');

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const tracked = trackPage(page);
    await ctx.addCookies(medicoCookies);

    await gotoApp(page, '/pacientes/nuevo');
    await expect(page.locator('form')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');

    const submitBtn = page.getByRole('button', { name: /Guardar|Crear paciente/i }).first();
    // Double-click to test debounce
    await submitBtn.click();
    await page.waitForTimeout(80);
    await submitBtn.click().catch(() => {});
    await page.waitForTimeout(800);

    const btnDisabled = await submitBtn.isDisabled().catch(() => false);
    await shot(page, 'live__double-click-save--desktop');
    record('live__double-click-debounce',
      btnDisabled ? 'PASS' : 'INFO',
      'Double-click save on empty form — check button disable/debounce',
      btnDisabled
        ? 'Button disabled after first click — debounce guard present'
        : 'Button not disabled — check if validation fired instead (also acceptable)',
      page.url(), '1280x900', 'medico',
      tracked, 'live__double-click-save--desktop.png'
    );

    await ctx.close();
  });

  test.afterAll(() => {
    saveLive();
  });
});
