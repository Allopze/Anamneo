# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/tests/e2e/encounter-draft-recovery.spec.ts >> Draft recovery with real Playwright session >> recovers the local draft when the clinical session is restored
- Location: frontend/tests/e2e/encounter-draft-recovery.spec.ts:107:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/register", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect, type BrowserContext, type Page } from '@playwright/test';
  2   | import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN, MEDICO_PASSWORD, RUN_ID } from './e2e-identities';
  3   | 
  4   | /**
  5   |  * E2E: draft recovery with real Playwright session.
  6   |  *
  7   |  * Self-contained: bootstraps admin via UI, creates a MEDICO invitation,
  8   |  * registers the medico via UI, then exercises the full draft lifecycle:
  9   |  * patient → encounter → section edit → localStorage draft → session restore → draft recovery.
  10  |  *
  11  |  * This replaces the original skipped test that used mocked /api/auth/me route.
  12  |  * The mock bypassed real auth and could not verify that the backend enforces
  13  |  * session validity, cookies and CORS — all of which must work for PHI safety.
  14  |  */
  15  | 
  16  | const sidebar = (page: Page) =>
  17  |   page.getByRole('navigation', { name: 'Navegación principal' });
  18  | const MEDICO_EMAIL = `medico+draft-recovery+${RUN_ID}@e2e-test.local`;
  19  | 
  20  | /**
  21  |  * Login helper — restores the real medico session captured in beforeAll.
  22  |  * Mirrors the pattern from workflow-clinical.spec.ts.
  23  |  */
  24  | async function loginAsMedico(page: Page, cookies: Awaited<ReturnType<BrowserContext['cookies']>>) {
  25  |   expect(cookies.length, 'Medico auth cookies should be available from beforeAll setup').toBeGreaterThan(0);
  26  |   await page.context().addCookies(cookies);
  27  |   await page.goto('/');
  28  |   await expect(sidebar(page)).toBeVisible({ timeout: 20_000 });
  29  | }
  30  | 
  31  | test.describe('Draft recovery with real Playwright session', () => {
  32  |   test.describe.configure({ mode: 'serial' });
  33  |   test.setTimeout(90_000);
  34  | 
  35  |   let medicoAuthCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
  36  |   let encounterId = '';
  37  |   let patientId = '';
  38  |   const draftNote = 'Paciente relata cefalea pulsátil con fotofobia desde hace 3 días.';
  39  | 
  40  |   // ── Setup: bootstrap admin → create invitation → register medico ──────────
  41  |   test.beforeAll(async ({ browser }) => {
  42  |     // 1. Bootstrap or reuse admin
  43  |     const adminCtx = await browser.newContext();
  44  |     const adminPage = await adminCtx.newPage();
  45  | 
> 46  |     await adminPage.goto('/register');
      |                     ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  47  |     const bootstrapTokenInput = adminPage.getByLabel('Token de instalación');
  48  |     const needsBootstrapRegistration = await bootstrapTokenInput.isVisible().catch(() => false);
  49  | 
  50  |     if (needsBootstrapRegistration) {
  51  |       await adminPage.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
  52  |       await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  53  |       await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
  54  |       await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
  55  |       await bootstrapTokenInput.fill(BOOTSTRAP_TOKEN);
  56  |       await adminPage.getByRole('checkbox', { name: /Acepto los/i }).check();
  57  | 
  58  |       const registerPromise = adminPage.waitForResponse(
  59  |         (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  60  |       );
  61  |       await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
  62  |       const registerResp = await registerPromise;
  63  |       expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
  64  |       await adminPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20_000 });
  65  |     } else {
  66  |       await adminPage.goto('/login');
  67  |       await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  68  |       await adminPage.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  69  |       await adminPage.getByRole('button', { name: 'Iniciar sesión' }).click();
  70  |       await expect(sidebar(adminPage)).toBeVisible({ timeout: 20_000 });
  71  |     }
  72  | 
  73  |     // 2. Create medico invitation
  74  |     const inviteResp = await adminPage.request.post('/api/users/invitations', {
  75  |       data: { email: MEDICO_EMAIL, role: 'MEDICO' },
  76  |     });
  77  |     expect(inviteResp.ok()).toBeTruthy();
  78  |     const { token: inviteToken } = await inviteResp.json();
  79  |     await adminCtx.close();
  80  | 
  81  |     // 3. Register medico via UI
  82  |     const medicoCtx = await browser.newContext();
  83  |     const medicoPage = await medicoCtx.newPage();
  84  | 
  85  |     await medicoPage.goto(`/register?token=${inviteToken}`);
  86  |     await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15_000 });
  87  |     await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba E2E');
  88  |     await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
  89  |     await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);
  90  |     await medicoPage.getByRole('checkbox', { name: /Acepto los/i }).check();
  91  | 
  92  |     const medicoRegPromise = medicoPage.waitForResponse(
  93  |       (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  94  |     );
  95  |     await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
  96  |     const medicoRegResp = await medicoRegPromise;
  97  |     expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);
  98  |     await medicoPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20_000 });
  99  |     await expect(sidebar(medicoPage)).toBeVisible({ timeout: 20_000 });
  100 | 
  101 |     // 4. Capture cookies for reuse in test body
  102 |     medicoAuthCookies = await medicoCtx.cookies();
  103 |     await medicoCtx.close();
  104 |   });
  105 | 
  106 |   // ── Test: create patient + encounter, save draft, restore session ──────────
  107 |   test('recovers the local draft when the clinical session is restored', async ({ browser }) => {
  108 |     // 1. Login with real session
  109 |     const sessionCtx = await browser.newContext();
  110 |     const sessionPage = await sessionCtx.newPage();
  111 |     await loginAsMedico(sessionPage, medicoAuthCookies);
  112 | 
  113 |     // 2. Create patient via UI (same pattern as workflow-clinical.spec.ts)
  114 |     await sessionPage.goto('/pacientes/nuevo');
  115 |     await expect(
  116 |       sessionPage.getByRole('heading', { name: /nuevo paciente/i }),
  117 |     ).toBeVisible({ timeout: 15_000 });
  118 | 
  119 |     await sessionPage.getByLabel('Nombre completo').fill('Paciente Draft Recovery');
  120 |     await sessionPage.getByLabel('RUT', { exact: true }).fill('22.222.222-2');
  121 |     await sessionPage.getByLabel('Fecha de nacimiento').fill('1986-03-20');
  122 |     await sessionPage.getByLabel('Sexo').selectOption('FEMENINO');
  123 |     await sessionPage.getByLabel('Previsión de salud').selectOption('FONASA');
  124 |     await sessionPage.getByRole('button', { name: /guardar paciente/i }).click();
  125 | 
  126 |     await expect(sessionPage.getByRole('heading', { name: 'Paciente Draft Recovery' })).toBeVisible({ timeout: 10_000 });
  127 |     await expect(sessionPage.getByRole('button', { name: /nueva atención/i })).toBeVisible({ timeout: 10_000 });
  128 |     const patientUrl = sessionPage.url();
  129 |     patientId = patientUrl.split('/pacientes/')[1]!;
  130 | 
  131 |     // 3. Create encounter via UI
  132 |     await sessionPage.getByRole('button', { name: /nueva atención/i }).click();
  133 |     // Wizard starts at "Identificación del paciente" — navigate to "Motivo de consulta"
  134 |     await expect(
  135 |       sessionPage.getByRole('heading', { name: 'Identificación del paciente' }),
  136 |     ).toBeVisible({ timeout: 15_000 });
  137 |     await sessionPage.getByRole('button', { name: /siguiente/i }).click();
  138 |     await expect(sessionPage.getByRole('heading', { name: /motivo de consulta/i })).toBeVisible({ timeout: 10_000 });
  139 |     const encounterUrl = sessionPage.url();
  140 |     encounterId = encounterUrl.split('/atenciones/')[1]!;
  141 | 
  142 |     // 4. Fill MOTIVO_CONSULTA section
  143 |     const motivoTextarea = sessionPage.getByPlaceholder(
  144 |       'Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz...',
  145 |     );
  146 |     await motivoTextarea.fill(draftNote);
```