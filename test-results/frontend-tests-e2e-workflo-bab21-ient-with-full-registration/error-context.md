# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/tests/e2e/workflow-clinical.spec.ts >> Clinical flow: patient → encounter → sections >> create patient with full registration
- Location: frontend/tests/e2e/workflow-clinical.spec.ts:172:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/register", waiting until "load"

```

# Test source

```ts
  1   | import path from 'path';
  2   | import { test, expect, type BrowserContext, type ConsoleMessage, type Page } from '@playwright/test';
  3   | import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN, MEDICO_PASSWORD, RUN_ID } from './e2e-identities';
  4   | 
  5   | /**
  6   |  * Clinical workflow E2E: patient → encounter → section editing.
  7   |  *
  8   |  * Self-contained: bootstraps admin via UI, creates a MEDICO invitation,
  9   |  * registers the medico via UI, then uses the medico for all clinical operations.
  10  |  */
  11  | 
  12  | const ATTACHMENT_FIXTURE_PATH = path.resolve(__dirname, 'fixtures', 'resultado-laboratorio-e2e.pdf');
  13  | const ROUTER_INIT_WARNING = 'Router action dispatched before initialization';
  14  | const MEDICO_EMAIL = `medico+workflow-clinical+${RUN_ID}@e2e-test.local`;
  15  | 
  16  | const sidebar = (page: Page) =>
  17  |   page.getByRole('navigation', { name: 'Navegación principal' });
  18  | const sectionRail = (page: Page) =>
  19  |   page.getByRole('navigation', { name: 'Secciones de la atención' });
  20  | 
  21  | function createRouterWarningMonitor(page: Page) {
  22  |   const warnings: string[] = [];
  23  |   const onConsole = (message: ConsoleMessage) => {
  24  |     const text = message.text();
  25  |     if (text.includes(ROUTER_INIT_WARNING)) {
  26  |       warnings.push(`[${message.type()}] ${text}`);
  27  |     }
  28  |   };
  29  | 
  30  |   page.on('console', onConsole);
  31  | 
  32  |   return {
  33  |     warnings,
  34  |     detach() {
  35  |       page.off('console', onConsole);
  36  |     },
  37  |   };
  38  | }
  39  | 
  40  | test.describe('Clinical flow: patient → encounter → sections', () => {
  41  |   test.describe.configure({ mode: 'serial' });
  42  |   test.setTimeout(60_000);
  43  |   let encounterPath = '';
  44  |   let medicoAuthCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
  45  | 
  46  |   // Setup: register admin (UI) → create invitation (API) → register medico (UI)
  47  |   test.beforeAll(async ({ browser }) => {
  48  |     // 1. Bootstrap or reuse admin session
  49  |     const adminCtx = await browser.newContext();
  50  |     const adminPage = await adminCtx.newPage();
  51  | 
> 52  |     await adminPage.goto('/register');
      |                     ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  53  |     const bootstrapTokenInput = adminPage.getByLabel('Token de instalación');
  54  |     const needsBootstrapRegistration = await bootstrapTokenInput.isVisible().catch(() => false);
  55  | 
  56  |     if (needsBootstrapRegistration) {
  57  |       await adminPage.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
  58  |       await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  59  |       await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
  60  |       await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
  61  |       await bootstrapTokenInput.fill(BOOTSTRAP_TOKEN);
  62  |       await adminPage.getByRole('checkbox', { name: /Acepto los/i }).check();
  63  | 
  64  |       const registerPromise = adminPage.waitForResponse(
  65  |         (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  66  |       );
  67  |       await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
  68  |       const registerResp = await registerPromise;
  69  |       expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
  70  |       await adminPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });
  71  |     } else {
  72  |       await adminPage.goto('/login');
  73  |       await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  74  |       await adminPage.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  75  |       await adminPage.getByRole('button', { name: 'Iniciar sesión' }).click();
  76  |       await expect(sidebar(adminPage)).toBeVisible({ timeout: 20000 });
  77  |     }
  78  | 
  79  |     // 2. Create medico invitation using admin session cookies
  80  |     const inviteResp = await adminPage.request.post('/api/users/invitations', {
  81  |       data: { email: MEDICO_EMAIL, role: 'MEDICO' },
  82  |     });
  83  |     expect(inviteResp.ok()).toBeTruthy();
  84  |     const { token: inviteToken } = await inviteResp.json();
  85  |     await adminCtx.close();
  86  | 
  87  |     // 3. Register medico via UI (clean context, no admin cookies)
  88  |     const medicoCtx = await browser.newContext();
  89  |     const medicoPage = await medicoCtx.newPage();
  90  | 
  91  |     await medicoPage.goto(`/register?token=${inviteToken}`);
  92  |     // Wait for invitation validation to complete (form loads async)
  93  |     await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15000 });
  94  |     await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba E2E');
  95  |     // Email is pre-filled from invitation (read-only)
  96  |     await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
  97  |     await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);
  98  |     await medicoPage.getByRole('checkbox', { name: /Acepto los/i }).check();
  99  | 
  100 |     const medicoRegPromise = medicoPage.waitForResponse(
  101 |       (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  102 |     );
  103 |     await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
  104 |     const medicoRegResp = await medicoRegPromise;
  105 |     expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);
  106 | 
  107 |     // Wait for registration to complete
  108 |     await medicoPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });
  109 | 
  110 |     medicoAuthCookies = await medicoCtx.cookies();
  111 |     expect(medicoAuthCookies.length, 'Medico auth cookies should be captured after registration').toBeGreaterThan(0);
  112 | 
  113 |     await medicoCtx.close();
  114 |   });
  115 | 
  116 |   async function loginAsMedico(page: Page) {
  117 |     expect(medicoAuthCookies, 'Medico auth cookies should be available from beforeAll setup').not.toHaveLength(0);
  118 |     await page.context().addCookies(medicoAuthCookies);
  119 |     await page.goto('/');
  120 |     await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
  121 |   }
  122 | 
  123 |   async function openEncounter(page: Page) {
  124 |     expect(encounterPath, 'Encounter path should be captured by the encounter creation test').toBeTruthy();
  125 |     await page.goto(encounterPath);
  126 |     await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/);
  127 |     await expect(
  128 |       page.getByRole('heading', { name: /identificación del paciente|anamnesis próxima|motivo de consulta/i }).first(),
  129 |     ).toBeVisible({ timeout: 15000 });
  130 |   }
  131 | 
  132 |   async function goToSection(page: Page, sectionName: string) {
  133 |     await sectionRail(page).getByRole('button', { name: new RegExp(sectionName, 'i') }).click();
  134 |     await expect(page.getByRole('heading', { name: sectionName, exact: true })).toBeVisible({ timeout: 5000 });
  135 |   }
  136 | 
  137 |   async function openWorkspaceTool(page: Page, tabName: 'Apoyo' | 'Cierre' | 'Revisión') {
  138 |     if (tabName === 'Cierre') {
  139 |       const cierreHeading = page.getByRole('heading', { name: 'Cierre', exact: true });
  140 |       await expect(cierreHeading).toBeVisible({ timeout: 5000 });
  141 |       return page.locator('section').filter({ has: cierreHeading }).first();
  142 |     }
  143 | 
  144 |     if (tabName === 'Revisión') {
  145 |       await page.getByRole('button', { name: /estado de revisión/i }).click();
  146 |       await expect(page.getByRole('heading', { name: 'Revisión' })).toBeVisible({ timeout: 5000 });
  147 |       return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Revisión' }) }).first();
  148 |     }
  149 | 
  150 |     await page.getByRole('button', { name: 'Más acciones de atención' }).click();
  151 |     await page.getByText('Apoyo clínico').click();
  152 |     await expect(page.getByRole('heading', { name: 'Apoyo clínico' })).toBeVisible({ timeout: 5000 });
```