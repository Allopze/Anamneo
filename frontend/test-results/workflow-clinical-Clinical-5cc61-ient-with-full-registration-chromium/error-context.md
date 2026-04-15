# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workflow-clinical.spec.ts >> Clinical flow: patient → encounter → sections >> create patient with full registration
- Location: tests/e2e/workflow-clinical.spec.ts:110:7

# Error details

```
Error: Login failed with 401: {"statusCode":401,"message":"Usuario no encontrado o inactivo","error":"Unauthorized","timestamp":"2026-04-15T12:09:40.205Z","path":"/api/auth/login"}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 401
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e7]: Anamneo
        - paragraph [ref=e8]: Espacio Clínico
        - heading "Contexto clínico desde el primer acceso." [level=1] [ref=e9]
        - generic [ref=e10]:
          - generic [ref=e11]:
            - img [ref=e12]
            - text: Flujo clínico
          - generic [ref=e15]:
            - img [ref=e16]
            - text: Revisión
          - generic [ref=e19]:
            - img [ref=e20]
            - text: Trazabilidad
          - generic [ref=e22]:
            - img [ref=e23]
            - text: Roles
    - main [ref=e28]:
      - generic [ref=e29]:
        - generic [ref=e30]:
          - paragraph [ref=e31]: Acceso
          - heading "Iniciar sesión" [level=2] [ref=e32]
        - alert [ref=e34]:
          - img [ref=e35]
          - paragraph [ref=e38]: Credenciales incorrectas. Verifica tu correo y contraseña.
        - generic [ref=e39]:
          - generic [ref=e40]:
            - generic [ref=e41]: Correo electrónico
            - generic [ref=e42]:
              - img [ref=e43]
              - textbox "Correo electrónico" [ref=e46]:
                - /placeholder: nombre@clinica.cl
                - text: medico@e2e-test.local
          - generic [ref=e47]:
            - generic [ref=e48]:
              - generic [ref=e49]: Contraseña
              - generic [ref=e50]: Usa la clave asignada a tu cuenta
            - generic [ref=e51]:
              - img [ref=e52]
              - textbox "Contraseña" [ref=e55]:
                - /placeholder: ••••••••
                - text: MedicoPass123!
          - button "Iniciar sesión" [ref=e56] [cursor=pointer]: Entrar a Anamneo
        - paragraph [ref=e58]:
          - text: ¿No tienes cuenta?
          - link "Crear cuenta" [ref=e59] [cursor=pointer]:
            - /url: /register
            - text: Crear cuenta
            - img [ref=e60]
  - button "Open Next.js Dev Tools" [ref=e67] [cursor=pointer]:
    - img [ref=e68]
  - alert [ref=e71]
```

# Test source

```ts
  4   |  * Clinical workflow E2E: patient → encounter → section editing.
  5   |  *
  6   |  * Self-contained: bootstraps admin via UI, creates a MEDICO invitation,
  7   |  * registers the medico via UI, then uses the medico for all clinical operations.
  8   |  */
  9   | 
  10  | const ADMIN_EMAIL = 'admin@e2e-test.local';
  11  | const ADMIN_PASSWORD = 'TestPass123!';
  12  | const MEDICO_EMAIL = 'medico@e2e-test.local';
  13  | const MEDICO_PASSWORD = 'MedicoPass123!';
  14  | const BOOTSTRAP_TOKEN = 'e2e-bootstrap-token';
  15  | 
  16  | const sidebar = (page: Page) =>
  17  |   page.getByRole('navigation', { name: 'Navegación principal' });
  18  | 
  19  | test.describe('Clinical flow: patient → encounter → sections', () => {
  20  |   test.describe.configure({ mode: 'serial' });
  21  | 
  22  |   // Setup: register admin (UI) → create invitation (API) → register medico (UI)
  23  |   test.beforeAll(async ({ browser }) => {
  24  |     // 1. Register admin via UI (same approach as smoke test)
  25  |     const adminCtx = await browser.newContext();
  26  |     const adminPage = await adminCtx.newPage();
  27  | 
  28  |     await adminPage.goto('/register');
  29  |     await adminPage.getByLabel('Nombre completo').fill('Admin E2E');
  30  |     await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  31  |     await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
  32  |     await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
  33  |     await adminPage.getByLabel('Token de instalación').fill(BOOTSTRAP_TOKEN);
  34  | 
  35  |     const registerPromise = adminPage.waitForResponse(
  36  |       (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  37  |     );
  38  |     await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
  39  |     const registerResp = await registerPromise;
  40  |     console.log(`[beforeAll] Admin register: ${registerResp.status()}`);
  41  |     expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
  42  | 
  43  |     // Wait for registration to complete and navigate away from register page
  44  |     await adminPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });
  45  | 
  46  |     // 2. Create medico invitation using admin session cookies
  47  |     const inviteResp = await adminPage.request.post('/api/users/invitations', {
  48  |       data: { email: MEDICO_EMAIL, role: 'MEDICO' },
  49  |     });
  50  |     console.log(`[beforeAll] Invite: ${inviteResp.status()}`);
  51  |     expect(inviteResp.ok()).toBeTruthy();
  52  |     const { token: inviteToken } = await inviteResp.json();
  53  |     await adminCtx.close();
  54  | 
  55  |     // 3. Register medico via UI (clean context, no admin cookies)
  56  |     const medicoCtx = await browser.newContext();
  57  |     const medicoPage = await medicoCtx.newPage();
  58  | 
  59  |     await medicoPage.goto(`/register?token=${inviteToken}`);
  60  |     // Wait for invitation validation to complete (form loads async)
  61  |     await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15000 });
  62  |     await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba E2E');
  63  |     // Email is pre-filled from invitation (read-only)
  64  |     await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
  65  |     await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);
  66  | 
  67  |     const medicoRegPromise = medicoPage.waitForResponse(
  68  |       (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
  69  |     );
  70  |     await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
  71  |     const medicoRegResp = await medicoRegPromise;
  72  |     const medicoRegBody = await medicoRegResp.text();
  73  |     console.log(`[beforeAll] Medico register: ${medicoRegResp.status()} ${medicoRegBody}`);
  74  |     expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);
  75  | 
  76  |     // Wait for registration to complete
  77  |     await medicoPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });
  78  | 
  79  |     // Check DB directly
  80  |     const { execSync } = require('child_process');
  81  |     const dbPath = '/home/allopze/dev/Anamneo/backend/prisma/e2e-playwright.db';
  82  |     const dbCheck = execSync(`sqlite3 "${dbPath}" "SELECT count(*) FROM users; SELECT email FROM users;"`).toString();
  83  |     console.log(`[beforeAll] DB check after medico reg: ${dbCheck.trim()}`);
  84  | 
  85  |     // Check via health endpoint too
  86  |     const healthResp = await medicoPage.request.get('/api/health');
  87  |     console.log(`[beforeAll] Health: ${healthResp.status()}`);
  88  | 
  89  |     await medicoCtx.close();
  90  |   });
  91  | 
  92  |   async function loginAsMedico(page: Page) {
  93  |     await page.goto('/login');
  94  |     await page.getByLabel('Correo electrónico').fill(MEDICO_EMAIL);
  95  |     await page.getByLabel('Contraseña').fill(MEDICO_PASSWORD);
  96  | 
  97  |     const loginPromise = page.waitForResponse(
  98  |       (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
  99  |     );
  100 |     await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  101 |     const loginResp = await loginPromise;
  102 |     const loginBody = await loginResp.text();
  103 |     console.log(`[loginAsMedico] ${loginResp.status()} ${loginBody}`);
> 104 |     expect(loginResp.status(), `Login failed with ${loginResp.status()}: ${loginBody}`).toBe(200);
      |                                                                                         ^ Error: Login failed with 401: {"statusCode":401,"message":"Usuario no encontrado o inactivo","error":"Unauthorized","timestamp":"2026-04-15T12:09:40.205Z","path":"/api/auth/login"}
  105 | 
  106 |     await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
  107 |     await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
  108 |   }
  109 | 
  110 |   test('create patient with full registration', async ({ page }) => {
  111 |     test.setTimeout(60_000);
  112 |     await loginAsMedico(page);
  113 | 
  114 |     await page.goto('/pacientes/nuevo');
  115 |     await expect(
  116 |       page.getByRole('heading', { name: /nuevo paciente/i }),
  117 |     ).toBeVisible({ timeout: 15000 });
  118 | 
  119 |     // Fill full registration
  120 |     await page.getByLabel('Nombre completo').fill('María Eugenia Flores Tapia');
  121 |     await page.getByLabel('RUT').fill('12.345.678-5');
  122 |     await page.getByLabel('Fecha de nacimiento').fill('1980-06-15');
  123 |     await page.getByLabel('Sexo').selectOption('FEMENINO');
  124 |     await page.getByLabel('Previsión de salud').selectOption('FONASA');
  125 | 
  126 |     await page.getByRole('button', { name: /guardar paciente/i }).click();
  127 | 
  128 |     // Should land on patient detail
  129 |     await expect(
  130 |       page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
  131 |     ).toBeVisible({ timeout: 10000 });
  132 |     await expect(page).toHaveURL(/\/pacientes\/[a-zA-Z0-9-]+$/);
  133 |   });
  134 | 
  135 |   test('verify patient ficha if needed', async ({ page }) => {
  136 |     test.setTimeout(30_000);
  137 |     await loginAsMedico(page);
  138 | 
  139 |     await page.goto('/pacientes');
  140 |     await page.getByText('María Eugenia Flores Tapia').first().click();
  141 |     await expect(
  142 |       page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
  143 |     ).toBeVisible({ timeout: 10000 });
  144 | 
  145 |     // Verify ficha if the validation banner is present
  146 |     const verifyBtn = page.getByRole('button', { name: /validar ficha/i });
  147 |     if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  148 |       await verifyBtn.click();
  149 |       await expect(page.getByText(/verificada/i)).toBeVisible({
  150 |         timeout: 10000,
  151 |       });
  152 |     }
  153 |   });
  154 | 
  155 |   test('patient search returns the new patient', async ({ page }) => {
  156 |     test.setTimeout(30_000);
  157 |     await loginAsMedico(page);
  158 | 
  159 |     await page.goto('/pacientes');
  160 |     await expect(
  161 |       page.getByRole('heading', { name: 'Pacientes' }),
  162 |     ).toBeVisible({ timeout: 15000 });
  163 | 
  164 |     await page.getByPlaceholder('Buscar por nombre o RUT').fill('Flores Tapia');
  165 |     await expect(
  166 |       page.getByText('María Eugenia Flores Tapia'),
  167 |     ).toBeVisible({ timeout: 5000 });
  168 |   });
  169 | 
  170 |   test('create encounter and fill motivo de consulta', async ({ page }) => {
  171 |     test.setTimeout(60_000);
  172 |     await loginAsMedico(page);
  173 | 
  174 |     // Navigate to patient detail
  175 |     await page.goto('/pacientes');
  176 |     await page.getByText('María Eugenia Flores Tapia').first().click();
  177 |     await expect(
  178 |       page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
  179 |     ).toBeVisible({ timeout: 10000 });
  180 | 
  181 |     // Create encounter
  182 |     await page.getByRole('button', { name: /nueva atención/i }).click();
  183 |     await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/, {
  184 |       timeout: 15000,
  185 |     });
  186 | 
  187 |     // Encounter header shows patient name
  188 |     await expect(
  189 |       page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
  190 |     ).toBeVisible();
  191 | 
  192 |     // Navigate past Identificación to Motivo de Consulta
  193 |     await page.getByRole('button', { name: /siguiente/i }).click();
  194 | 
  195 |     // Fill the motivo textarea
  196 |     const textarea = page.locator('textarea');
  197 |     await expect(textarea).toBeVisible({ timeout: 5000 });
  198 |     await textarea.fill(
  199 |       'Dolor abdominal agudo de 3 días de evolución, localizado en fosa ilíaca derecha.',
  200 |     );
  201 | 
  202 |     // Save and verify
  203 |     await page.getByRole('button', { name: 'Guardar Ahora' }).click();
  204 |     await expect(page.locator('[role="status"]')).toContainText(/guardad/i, {
```