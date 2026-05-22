# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: accessibility.spec.ts >> Accessibility gate >> authenticated routes have no serious automated axe violations
- Location: tests/e2e/accessibility.spec.ts:176:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading').first()

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]
  - main [ref=e25]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN, MEDICO_PASSWORD, RUN_ID } from './e2e-identities';
  4   | 
  5   | const PUBLIC_ROUTES = [
  6   |   '/login',
  7   |   '/forgot-password',
  8   |   '/politica-de-privacidad',
  9   |   '/terminos-y-condiciones',
  10  | ] as const;
  11  | 
  12  | const MEDICO_EMAIL = `medico+a11y+${RUN_ID}@e2e-test.local`;
  13  | const TEST_LEGAL_ACCEPTANCE = {
  14  |   acceptedTermsVersion: '2026-05-02',
  15  |   acceptedPrivacyVersion: '2026-05-02',
  16  | };
  17  | 
  18  | const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' });
  19  | 
  20  | async function waitForRouteReady(page: Page, route: string) {
  21  |   if (route === '/login' || route === '/forgot-password') {
  22  |     await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  23  |     return;
  24  |   }
  25  | 
  26  |   if (route === '/') {
  27  |     await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
  28  |     return;
  29  |   }
  30  | 
  31  |   if (route.startsWith('/pacientes/') && route !== '/pacientes/nuevo') {
  32  |     await expect(page.getByRole('heading', { name: /paciente accesibilidad/i })).toBeVisible({ timeout: 15000 });
  33  |     return;
  34  |   }
  35  | 
> 36  |   await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  37  | }
  38  | 
  39  | async function expectNoCriticalA11yViolations(page: Page) {
  40  |   const results = await new AxeBuilder({ page })
  41  |     .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  42  |     .analyze();
  43  | 
  44  |   const actionableViolations = results.violations.filter((violation) =>
  45  |     ['critical', 'serious'].includes(violation.impact || ''),
  46  |   );
  47  | 
  48  |   expect(actionableViolations).toEqual([]);
  49  | }
  50  | 
  51  | test.describe('Accessibility gate', () => {
  52  |   test.describe.configure({ mode: 'serial', timeout: 120_000 });
  53  |   test.use({ viewport: { width: 1280, height: 900 } });
  54  | 
  55  |   let patientId = '';
  56  | 
  57  |   test.beforeAll(async ({ browser }) => {
  58  |     const adminCtx = await browser.newContext();
  59  |     const adminPage = await adminCtx.newPage();
  60  | 
  61  |     const bootstrapResp = await adminPage.request.get('/api/auth/bootstrap');
  62  |     expect(bootstrapResp.ok(), 'Bootstrap status request should succeed').toBeTruthy();
  63  |     const bootstrapState = (await bootstrapResp.json()) as { hasAdmin?: boolean };
  64  | 
  65  |     if (!bootstrapState.hasAdmin) {
  66  |       const registerResp = await adminPage.request.post('/api/auth/register', {
  67  |         data: {
  68  |           email: ADMIN_EMAIL,
  69  |           password: ADMIN_PASSWORD,
  70  |           nombre: ADMIN_NOMBRE,
  71  |           role: 'ADMIN',
  72  |           bootstrapToken: BOOTSTRAP_TOKEN,
  73  |           ...TEST_LEGAL_ACCEPTANCE,
  74  |         },
  75  |       });
  76  |       expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
  77  |     } else {
  78  |       const loginResp = await adminPage.request.post('/api/auth/login', {
  79  |         data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  80  |       });
  81  |       expect(loginResp.ok(), 'Admin API login should succeed').toBeTruthy();
  82  |     }
  83  | 
  84  |     const inviteResp = await adminPage.request.post('/api/users/invitations', {
  85  |       data: { email: MEDICO_EMAIL, role: 'MEDICO' },
  86  |     });
  87  |     expect(inviteResp.ok(), 'Medico invitation should succeed').toBeTruthy();
  88  |     const { token: inviteToken } = await inviteResp.json();
  89  |     await adminCtx.close();
  90  | 
  91  |     const medicoCtx = await browser.newContext();
  92  |     const medicoPage = await medicoCtx.newPage();
  93  |     const medicoRegResp = await medicoPage.request.post('/api/auth/register', {
  94  |       data: {
  95  |         email: MEDICO_EMAIL,
  96  |         password: MEDICO_PASSWORD,
  97  |         nombre: 'Dra. Accesibilidad E2E',
  98  |         role: 'MEDICO',
  99  |         invitationToken: inviteToken,
  100 |         ...TEST_LEGAL_ACCEPTANCE,
  101 |       },
  102 |     });
  103 |     expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);
  104 | 
  105 |     const patientResp = await medicoPage.request.post('/api/patients', {
  106 |       data: {
  107 |         nombre: 'Paciente Accesibilidad',
  108 |         fechaNacimiento: '1978-03-12',
  109 |         edad: 48,
  110 |         sexo: 'FEMENINO',
  111 |         prevision: 'FONASA',
  112 |       },
  113 |     });
  114 |     expect(patientResp.ok(), 'A11y patient fixture should be created').toBeTruthy();
  115 |     patientId = ((await patientResp.json()) as { id: string }).id;
  116 |     await medicoCtx.close();
  117 |   });
  118 | 
  119 |   async function loginAsMedico(page: Page) {
  120 |     await page.goto('/login');
  121 |     const appUrl = new URL(page.url()).origin;
  122 |     const loginResp = await page.request.post('/api/auth/login', {
  123 |       data: { email: MEDICO_EMAIL, password: MEDICO_PASSWORD },
  124 |     });
  125 |     expect(loginResp.ok(), 'Medico API login should succeed').toBeTruthy();
  126 |     const loginBody = (await loginResp.json()) as {
  127 |       user: {
  128 |         id: string;
  129 |         email: string;
  130 |         nombre: string;
  131 |         role: string;
  132 |         isAdmin?: boolean;
  133 |         medicoId?: string | null;
  134 |         mustChangePassword?: boolean;
  135 |         totpEnabled?: boolean;
  136 |       };
```