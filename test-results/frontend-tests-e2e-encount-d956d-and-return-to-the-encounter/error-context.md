# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend/tests/e2e/encounter-draft-recovery.spec.ts >> recovers the local draft after 401, login and return to the encounter
- Location: frontend/tests/e2e/encounter-draft-recovery.spec.ts:93:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/atenciones/enc-1", waiting until "load"

```

# Test source

```ts
  172 |   });
  173 | 
  174 |   await page.route('**/api/encounters/enc-1', async (route) => {
  175 |     await route.fulfill({
  176 |       status: 200,
  177 |       contentType: 'application/json',
  178 |       body: JSON.stringify(encounterPayload),
  179 |     });
  180 |   });
  181 | 
  182 |   await page.route('**/api/encounters/stats/dashboard', async (route) => {
  183 |     await route.fulfill({
  184 |       status: 200,
  185 |       contentType: 'application/json',
  186 |       body: JSON.stringify({
  187 |         counts: {
  188 |           enProgreso: 1,
  189 |           completado: 0,
  190 |           cancelado: 0,
  191 |           total: 1,
  192 |           pendingReview: 0,
  193 |           upcomingTasks: 0,
  194 |           overdueTasks: 0,
  195 |           patientIncomplete: 0,
  196 |           patientPendingVerification: 0,
  197 |           patientVerified: 1,
  198 |           patientNonVerified: 0,
  199 |         },
  200 |         recent: [],
  201 |         upcomingTasks: [],
  202 |       }),
  203 |     });
  204 |   });
  205 | 
  206 |   await page.route('**/api/alerts/unacknowledged-count', async (route) => {
  207 |     await route.fulfill({
  208 |       status: 200,
  209 |       contentType: 'application/json',
  210 |       body: JSON.stringify({ count: 0 }),
  211 |     });
  212 |   });
  213 | 
  214 |   await page.route('**/api/alerts/unacknowledged', async (route) => {
  215 |     await route.fulfill({
  216 |       status: 200,
  217 |       contentType: 'application/json',
  218 |       body: JSON.stringify({ data: [] }),
  219 |     });
  220 |   });
  221 | 
  222 |   await page.route('**/api/patients/patient-1', async (route) => {
  223 |     await route.fulfill({
  224 |       status: 200,
  225 |       contentType: 'application/json',
  226 |       body: JSON.stringify({
  227 |         id: 'patient-1',
  228 |         nombre: 'Paciente Demo',
  229 |         rut: '11.111.111-1',
  230 |         rutExempt: false,
  231 |         rutExemptReason: null,
  232 |         edad: 44,
  233 |         sexo: 'FEMENINO',
  234 |         trabajo: null,
  235 |         prevision: 'FONASA',
  236 |         domicilio: null,
  237 |         createdAt: '2026-04-04T12:00:00.000Z',
  238 |         updatedAt: '2026-04-04T12:00:00.000Z',
  239 |         history: {},
  240 |         problems: [],
  241 |         tasks: [],
  242 |       }),
  243 |     });
  244 |   });
  245 | 
  246 |   await page.route('**/api/patients/patient-1/encounters?page=1&limit=1', async (route) => {
  247 |     await route.fulfill({
  248 |       status: 200,
  249 |       contentType: 'application/json',
  250 |       body: JSON.stringify({
  251 |         data: [],
  252 |         pagination: {
  253 |           page: 1,
  254 |           limit: 1,
  255 |           total: 0,
  256 |           totalPages: 0,
  257 |         },
  258 |       }),
  259 |     });
  260 |   });
  261 | 
  262 |   await page.route('**/api/templates**', async (route) => {
  263 |     await route.fulfill({
  264 |       status: 200,
  265 |       contentType: 'application/json',
  266 |       body: JSON.stringify([]),
  267 |     });
  268 |   });
  269 | 
  270 |   const draftNote = 'Paciente relata cefalea pulsátil con fotofobia desde hace 3 días.';
  271 | 
> 272 |   await page.goto('/atenciones/enc-1');
      |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  273 |   await expect(page.getByRole('heading', { name: 'Identificación' })).toBeVisible();
  274 | 
  275 |   await page.getByRole('button', { name: 'Siguiente' }).click();
  276 |   await expect(page.getByRole('heading', { name: 'Motivo de Consulta' })).toBeVisible();
  277 | 
  278 |   const motivoTextarea = page.getByPlaceholder('Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz...');
  279 |   await motivoTextarea.fill(draftNote);
  280 | 
  281 |   await page.waitForURL('**/login?from=*');
  282 |   await expect(page).toHaveURL(/\/login\?from=%2Fatenciones%2Fenc-1/);
  283 | 
  284 |   await page.getByLabel('Correo electrónico').fill('medico@anamneo.cl');
  285 |   await page.getByLabel('Contraseña').fill('Admin123');
  286 |   await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  287 | 
  288 |   await page.waitForURL('**/atenciones/enc-1', { waitUntil: 'commit' });
  289 |   await expect(page.getByRole('heading', { name: 'Motivo de Consulta' })).toBeVisible();
  290 |   await expect(motivoTextarea).toHaveValue(draftNote);
  291 | });
  292 | 
```