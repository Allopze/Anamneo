# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/tests/e2e/workflow-clinical.spec.ts >> Clinical flow: patient → encounter → sections >> create patient with full registration
- Location: frontend/tests/e2e/workflow-clinical.spec.ts:158:7

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
  3   | import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN, MEDICO_EMAIL, MEDICO_PASSWORD } from './e2e-identities';
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
  14  | 
  15  | const sidebar = (page: Page) =>
  16  |   page.getByRole('navigation', { name: 'Navegación principal' });
  17  | const sectionRail = (page: Page) =>
  18  |   page.getByRole('navigation', { name: 'Secciones de la atención' });
  19  | 
  20  | function createRouterWarningMonitor(page: Page) {
  21  |   const warnings: string[] = [];
  22  |   const onConsole = (message: ConsoleMessage) => {
  23  |     const text = message.text();
  24  |     if (text.includes(ROUTER_INIT_WARNING)) {
  25  |       warnings.push(`[${message.type()}] ${text}`);
  26  |     }
  27  |   };
  28  | 
  29  |   page.on('console', onConsole);
  30  | 
  31  |   return {
  32  |     warnings,
  33  |     detach() {
  34  |       page.off('console', onConsole);
  35  |     },
  36  |   };
  37  | }
  38  | 
  39  | test.describe('Clinical flow: patient → encounter → sections', () => {
  40  |   test.describe.configure({ mode: 'serial' });
  41  |   test.setTimeout(60_000);
  42  |   let encounterPath = '';
  43  |   let medicoAuthCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];
  44  | 
  45  |   // Setup: register admin (UI) → create invitation (API) → register medico (UI)
  46  |   test.beforeAll(async ({ browser }) => {
  47  |     // 1. Bootstrap or reuse admin session
  48  |     const adminCtx = await browser.newContext();
  49  |     const adminPage = await adminCtx.newPage();
  50  | 
> 51  |     await adminPage.goto('/register');
      |                     ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  52  |     const bootstrapTokenInput = adminPage.getByLabel('Token de instalación');
  53  |     const needsBootstrapRegistration = await bootstrapTokenInput.isVisible().catch(() => false);
  54  | 
  55  |     if (needsBootstrapRegistration) {
  56  |       await adminPage.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
  57  |       await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  58  |       await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
  59  |       await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
  60  |       await bootstrapTokenInput.fill(BOOTSTRAP_TOKEN);
  61  | 
  62  |       const registerPromise = adminPage.waitForResponse(
  63  |         (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  64  |       );
  65  |       await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
  66  |       const registerResp = await registerPromise;
  67  |       expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
  68  |       await adminPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });
  69  |     } else {
  70  |       await adminPage.goto('/login');
  71  |       await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  72  |       await adminPage.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
  73  |       await adminPage.getByRole('button', { name: 'Iniciar sesión' }).click();
  74  |       await expect(sidebar(adminPage)).toBeVisible({ timeout: 20000 });
  75  |     }
  76  | 
  77  |     // 2. Create medico invitation using admin session cookies
  78  |     const inviteResp = await adminPage.request.post('/api/users/invitations', {
  79  |       data: { email: MEDICO_EMAIL, role: 'MEDICO' },
  80  |     });
  81  |     expect(inviteResp.ok()).toBeTruthy();
  82  |     const { token: inviteToken } = await inviteResp.json();
  83  |     await adminCtx.close();
  84  | 
  85  |     // 3. Register medico via UI (clean context, no admin cookies)
  86  |     const medicoCtx = await browser.newContext();
  87  |     const medicoPage = await medicoCtx.newPage();
  88  | 
  89  |     await medicoPage.goto(`/register?token=${inviteToken}`);
  90  |     // Wait for invitation validation to complete (form loads async)
  91  |     await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15000 });
  92  |     await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba E2E');
  93  |     // Email is pre-filled from invitation (read-only)
  94  |     await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
  95  |     await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);
  96  | 
  97  |     const medicoRegPromise = medicoPage.waitForResponse(
  98  |       (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  99  |     );
  100 |     await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
  101 |     const medicoRegResp = await medicoRegPromise;
  102 |     expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);
  103 | 
  104 |     // Wait for registration to complete
  105 |     await medicoPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });
  106 | 
  107 |     medicoAuthCookies = await medicoCtx.cookies();
  108 |     expect(medicoAuthCookies.length, 'Medico auth cookies should be captured after registration').toBeGreaterThan(0);
  109 | 
  110 |     await medicoCtx.close();
  111 |   });
  112 | 
  113 |   async function loginAsMedico(page: Page) {
  114 |     expect(medicoAuthCookies, 'Medico auth cookies should be available from beforeAll setup').not.toHaveLength(0);
  115 |     await page.context().addCookies(medicoAuthCookies);
  116 |     await page.goto('/');
  117 |     await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
  118 |   }
  119 | 
  120 |   async function openEncounter(page: Page) {
  121 |     expect(encounterPath, 'Encounter path should be captured by the encounter creation test').toBeTruthy();
  122 |     await page.goto(encounterPath);
  123 |     await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/);
  124 |     await expect(
  125 |       page.getByRole('heading', { name: /identificación del paciente|anamnesis próxima|motivo de consulta/i }).first(),
  126 |     ).toBeVisible({ timeout: 15000 });
  127 |   }
  128 | 
  129 |   async function goToSection(page: Page, sectionName: string) {
  130 |     await sectionRail(page).getByRole('button', { name: new RegExp(sectionName, 'i') }).click();
  131 |     await expect(page.getByRole('heading', { name: sectionName, exact: true })).toBeVisible({ timeout: 5000 });
  132 |   }
  133 | 
  134 |   async function openDrawerTab(page: Page, tabName: string) {
  135 |     await page.getByRole('button', { name: /abrir panel lateral/i }).click();
  136 |     const drawer = page.getByRole('dialog', { name: 'Panel lateral de la atención' });
  137 |     await expect(drawer).toBeVisible({ timeout: 5000 });
  138 |     await drawer.getByRole('button', { name: tabName }).click();
  139 |     return drawer;
  140 |   }
  141 | 
  142 |   async function completeVisibleSection(page: Page, nextSectionName?: string) {
  143 |     const nextButton = page.getByRole('button', { name: 'Siguiente' });
  144 |     if (await nextButton.isVisible().catch(() => false)) {
  145 |       await nextButton.click();
  146 |       if (nextSectionName) {
  147 |         await expect(page.getByRole('heading', { name: nextSectionName })).toBeVisible({ timeout: 5000 });
  148 |       }
  149 |       return;
  150 |     }
  151 | 
```