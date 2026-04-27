import path from 'path';
import { test, expect, type BrowserContext, type ConsoleMessage, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN, MEDICO_EMAIL, MEDICO_PASSWORD } from './e2e-identities';

/**
 * Clinical workflow E2E: patient → encounter → section editing.
 *
 * Self-contained: bootstraps admin via UI, creates a MEDICO invitation,
 * registers the medico via UI, then uses the medico for all clinical operations.
 */

const ATTACHMENT_FIXTURE_PATH = path.resolve(__dirname, 'fixtures', 'resultado-laboratorio-e2e.pdf');
const ROUTER_INIT_WARNING = 'Router action dispatched before initialization';

const sidebar = (page: Page) =>
  page.getByRole('navigation', { name: 'Navegación principal' });
const sectionRail = (page: Page) =>
  page.getByRole('navigation', { name: 'Secciones de la atención' });

function createRouterWarningMonitor(page: Page) {
  const warnings: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    const text = message.text();
    if (text.includes(ROUTER_INIT_WARNING)) {
      warnings.push(`[${message.type()}] ${text}`);
    }
  };

  page.on('console', onConsole);

  return {
    warnings,
    detach() {
      page.off('console', onConsole);
    },
  };
}

test.describe('Clinical flow: patient → encounter → sections', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60_000);
  let encounterPath = '';
  let medicoAuthCookies: Awaited<ReturnType<BrowserContext['cookies']>> = [];

  // Setup: register admin (UI) → create invitation (API) → register medico (UI)
  test.beforeAll(async ({ browser }) => {
    // 1. Bootstrap or reuse admin session
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    await adminPage.goto('/register');
    const bootstrapTokenInput = adminPage.getByLabel('Token de instalación');
    const needsBootstrapRegistration = await bootstrapTokenInput.isVisible().catch(() => false);

    if (needsBootstrapRegistration) {
      await adminPage.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
      await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
      await adminPage.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
      await adminPage.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
      await bootstrapTokenInput.fill(BOOTSTRAP_TOKEN);

      const registerPromise = adminPage.waitForResponse(
        (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
      );
      await adminPage.getByRole('button', { name: /Crear cuenta/i }).click();
      const registerResp = await registerPromise;
      expect(registerResp.status(), 'Admin registration should return 201').toBe(201);
      await adminPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });
    } else {
      await adminPage.goto('/login');
      await adminPage.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
      await adminPage.getByLabel('Contraseña').fill(ADMIN_PASSWORD);
      await adminPage.getByRole('button', { name: 'Iniciar sesión' }).click();
      await expect(sidebar(adminPage)).toBeVisible({ timeout: 20000 });
    }

    // 2. Create medico invitation using admin session cookies
    const inviteResp = await adminPage.request.post('/api/users/invitations', {
      data: { email: MEDICO_EMAIL, role: 'MEDICO' },
    });
    expect(inviteResp.ok()).toBeTruthy();
    const { token: inviteToken } = await inviteResp.json();
    await adminCtx.close();

    // 3. Register medico via UI (clean context, no admin cookies)
    const medicoCtx = await browser.newContext();
    const medicoPage = await medicoCtx.newPage();

    await medicoPage.goto(`/register?token=${inviteToken}`);
    // Wait for invitation validation to complete (form loads async)
    await expect(medicoPage.getByText(/Invitación validada/i)).toBeVisible({ timeout: 15000 });
    await medicoPage.getByLabel('Nombre completo').fill('Dra. Prueba E2E');
    // Email is pre-filled from invitation (read-only)
    await medicoPage.getByLabel('Contraseña', { exact: true }).fill(MEDICO_PASSWORD);
    await medicoPage.getByLabel('Confirmar contraseña').fill(MEDICO_PASSWORD);

    const medicoRegPromise = medicoPage.waitForResponse(
      (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
    );
    await medicoPage.getByRole('button', { name: /Crear cuenta/i }).click();
    const medicoRegResp = await medicoRegPromise;
    expect(medicoRegResp.status(), 'Medico registration should return 201').toBe(201);

    // Wait for registration to complete
    await medicoPage.waitForURL((url) => !url.toString().includes('/register'), { timeout: 20000 });

    medicoAuthCookies = await medicoCtx.cookies();
    expect(medicoAuthCookies.length, 'Medico auth cookies should be captured after registration').toBeGreaterThan(0);

    await medicoCtx.close();
  });

  async function loginAsMedico(page: Page) {
    expect(medicoAuthCookies, 'Medico auth cookies should be available from beforeAll setup').not.toHaveLength(0);
    await page.context().addCookies(medicoAuthCookies);
    await page.goto('/');
    await expect(sidebar(page)).toBeVisible({ timeout: 15000 });
  }

  async function openEncounter(page: Page) {
    expect(encounterPath, 'Encounter path should be captured by the encounter creation test').toBeTruthy();
    await page.goto(encounterPath);
    await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/);
    await expect(
      page.getByRole('heading', { name: /identificación del paciente|anamnesis próxima|motivo de consulta/i }).first(),
    ).toBeVisible({ timeout: 15000 });
  }

  async function goToSection(page: Page, sectionName: string) {
    await sectionRail(page).getByRole('button', { name: new RegExp(sectionName, 'i') }).click();
    await expect(page.getByRole('heading', { name: sectionName, exact: true })).toBeVisible({ timeout: 5000 });
  }

  async function openWorkspaceTool(page: Page, tabName: 'Apoyo' | 'Cierre' | 'Revisión') {
    if (tabName === 'Cierre') {
      await expect(page.getByRole('heading', { name: 'Cierre' })).toBeVisible({ timeout: 5000 });
      return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Cierre' }) }).first();
    }

    if (tabName === 'Revisión') {
      await page.getByRole('button', { name: /estado de revisión/i }).click();
      await expect(page.getByRole('heading', { name: 'Revisión' })).toBeVisible({ timeout: 5000 });
      return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Revisión' }) }).first();
    }

    await page.getByRole('button', { name: 'Más acciones de atención' }).click();
    await page.getByText('Apoyo clínico').click();
    await expect(page.getByRole('heading', { name: 'Apoyo clínico' })).toBeVisible({ timeout: 5000 });
    return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Apoyo clínico' }) }).first();
  }

  async function completeVisibleSection(page: Page, nextSectionName?: string) {
    const nextButton = page.getByRole('button', { name: 'Siguiente' });
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
      if (nextSectionName) {
        await expect(page.getByRole('heading', { name: nextSectionName })).toBeVisible({ timeout: 5000 });
      }
      return;
    }

    const completeButton = page.getByRole('button', { name: 'Completar' });
    await expect(completeButton).toBeVisible({ timeout: 5000 });
    await completeButton.click();
    await expect(completeButton).toBeHidden({ timeout: 10000 });
  }

  test('create patient with full registration', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);

    await page.goto('/pacientes/nuevo');
    await expect(
      page.getByRole('heading', { name: /nuevo paciente/i }),
    ).toBeVisible({ timeout: 15000 });

    // Fill full registration
    await page.getByLabel('Nombre completo').fill('María Eugenia Flores Tapia');
    await page.getByLabel('RUT', { exact: true }).fill('12.345.678-5');
    await page.getByLabel('Fecha de nacimiento').fill('1980-06-15');
    await page.getByLabel('Sexo').selectOption('FEMENINO');
    await page.getByLabel('Previsión de salud').selectOption('FONASA');

    await page.getByRole('button', { name: /guardar paciente/i }).click();

    // Should land on patient detail
    await expect(
      page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/pacientes\/[a-zA-Z0-9-]+$/);
  });

  test('verify patient ficha if needed', async ({ page }) => {
    test.setTimeout(30_000);
    await loginAsMedico(page);

    await page.goto('/pacientes');
    await page.getByText('María Eugenia Flores Tapia').first().click();
    await expect(
      page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
    ).toBeVisible({ timeout: 10000 });

    // Verify ficha if the validation banner is present
    const verifyBtn = page.getByRole('button', { name: /validar ficha/i });
    if (await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await verifyBtn.click();
      await expect(page.getByText(/verificada/i)).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test('patient search returns the new patient', async ({ page }) => {
    test.setTimeout(30_000);
    await loginAsMedico(page);

    await page.goto('/pacientes');
    await expect(
      page.getByRole('heading', { name: 'Pacientes' }),
    ).toBeVisible({ timeout: 15000 });

    await page.getByPlaceholder('Buscar por nombre o RUT').fill('Flores Tapia');
    await expect(
      page.getByText('María Eugenia Flores Tapia'),
    ).toBeVisible({ timeout: 5000 });
  });

  test('create encounter and fill motivo de consulta', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);

    // Navigate to patient detail
    await page.goto('/pacientes');
    await page.getByText('María Eugenia Flores Tapia').first().click();
    await expect(
      page.getByRole('heading', { name: 'María Eugenia Flores Tapia' }),
    ).toBeVisible({ timeout: 10000 });

    // Create encounter
    await page.getByRole('button', { name: /nueva atención/i }).click();
    await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/, {
      timeout: 15000,
    });

    // Wait for the first visible section of the wizard to load
    await expect(
      page.getByRole('heading', { name: 'Identificación del paciente' }),
    ).toBeVisible();

    // Navigate past Identificación to Motivo de Consulta
    await page.getByRole('button', { name: /siguiente/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Motivo de consulta' }),
    ).toBeVisible({ timeout: 5000 });

    // Fill the motivo textarea
    const textarea = page.getByPlaceholder(/paciente refiere dolor de cabeza intenso/i);
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill(
      'Dolor abdominal agudo de 3 días de evolución, localizado en fosa ilíaca derecha.',
    );

    // Save and verify
    const saveButton = page.getByRole('button', { name: 'Guardar Ahora' });
    await saveButton.click();
    await expect(
      page.getByRole('status').filter({ hasText: /cambios guardados|guardado a las|sin cambios/i }),
    ).toBeVisible({
      timeout: 10000,
    });
    await expect(saveButton).toBeDisabled();

    await page.getByRole('button', { name: /siguiente/i }).click();
    await expect(page.getByRole('heading', { name: 'Anamnesis próxima' })).toBeVisible({ timeout: 5000 });
    encounterPath = new URL(page.url()).pathname;
  });

  test('upload attachment to encounter', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);
    await openEncounter(page);

    const supportTool = await openWorkspaceTool(page, 'Apoyo');
    await supportTool.getByRole('button', { name: 'Adjuntos de la Atención' }).click();

    const attachmentsDialog = page.getByRole('dialog', { name: 'Adjuntos de la atención' });
    await expect(attachmentsDialog).toBeVisible({ timeout: 5000 });
    await attachmentsDialog.locator('#attachment-file').setInputFiles(ATTACHMENT_FIXTURE_PATH);
    await attachmentsDialog.locator('#attachment-description').fill('Resultado de laboratorio cargado desde Playwright');
    const uploadResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/attachments/encounter/') && response.request().method() === 'POST',
    );
    await attachmentsDialog.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status(), await uploadResponse.text()).toBe(201);

    await expect(
      attachmentsDialog.getByText('resultado-laboratorio-e2e.pdf'),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      attachmentsDialog.getByText('GENERAL · Resultado de laboratorio cargado desde Playwright'),
    ).toBeVisible({ timeout: 10000 });
    await attachmentsDialog.getByRole('button', { name: 'Cerrar adjuntos' }).click({ force: true });
  });

  test('queue not-applicable saves locally when the section save falls back to offline mode', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);
    await openEncounter(page);

    await goToSection(page, 'Observaciones');
    await page.route(/\/api\/encounters\/.+\/sections\/OBSERVACIONES$/, (route) => route.abort('internetdisconnected'));

    await page.getByRole('button', { name: 'No aplica' }).click();
    await page.getByPlaceholder(/Paciente pediátrico/i).fill('No corresponde para este seguimiento ambulatorio.');
    await page.getByRole('button', { name: 'Confirmar' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Guardado en cola local' }).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('Sincronizando 1 cambio…')).toBeVisible({ timeout: 10000 });
  });

  test('keeps focused clinical documents available before completion while full PDF stays blocked', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);

    expect(encounterPath, 'Encounter path should be available before validating focused documents').toBeTruthy();
    await page.goto(`${encounterPath}/ficha`);
    await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+\/ficha$/, { timeout: 15000 });

    await expect(page.getByRole('button', { name: 'Receta' })).toBeEnabled({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Órdenes' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Derivación' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Descargar PDF' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Imprimir' })).toBeDisabled();
    await expect(page.getByText(/PDF clínico completo e impresión aún no disponibles/i)).toBeVisible();

    const recetaResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/encounters/')
        && response.url().includes('/export/document/receta')
        && response.request().method() === 'GET',
    );
    await page.getByRole('button', { name: 'Receta' }).click();
    const recetaResponse = await recetaResponsePromise;
    expect(recetaResponse.status(), await recetaResponse.text()).toBe(200);
  });

  test('deletes an attachment and keeps it out of the ficha clinica', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsMedico(page);
    await openEncounter(page);

    const supportTool = await openWorkspaceTool(page, 'Apoyo');
    await supportTool.getByRole('button', { name: 'Adjuntos de la Atención' }).click();

    const attachmentsDialog = page.getByRole('dialog', { name: 'Adjuntos de la atención' });
    await expect(attachmentsDialog).toBeVisible({ timeout: 5000 });
    await expect(attachmentsDialog.getByText('resultado-laboratorio-e2e.pdf')).toBeVisible({ timeout: 10000 });

    await attachmentsDialog
      .locator('li')
      .filter({ hasText: 'resultado-laboratorio-e2e.pdf' })
      .getByRole('button', { name: 'Eliminar' })
      .click();
    await expect(attachmentsDialog.getByText(/Vas a eliminar resultado-laboratorio-e2e\.pdf/i)).toBeVisible({ timeout: 5000 });

    const deleteResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/attachments/') && response.request().method() === 'DELETE',
    );
    await attachmentsDialog.getByRole('button', { name: 'Confirmar eliminación' }).click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status(), await deleteResponse.text()).toBe(200);

    await expect(attachmentsDialog.getByText('resultado-laboratorio-e2e.pdf')).toHaveCount(0);
    await expect(attachmentsDialog.getByText('No hay archivos adjuntos.')).toBeVisible({ timeout: 10000 });
    await attachmentsDialog.getByRole('button', { name: 'Cerrar adjuntos' }).click({ force: true });

    await page.getByRole('button', { name: 'Ficha Clínica' }).click();
    await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+\/ficha$/, { timeout: 15000 });
    await expect(page.getByText('resultado-laboratorio-e2e.pdf')).toHaveCount(0);
  });

  test('refreshes the wizard with the latest server section when another tab wins a save conflict', async ({ browser, page }) => {
    test.setTimeout(90_000);
    await loginAsMedico(page);
    await openEncounter(page);
    await goToSection(page, 'Observaciones');

    const firstTabNotes = page.getByPlaceholder('Cualquier observación adicional relevante para el registro...');
    await expect(firstTabNotes).toBeVisible({ timeout: 10000 });

    const secondContext = await browser.newContext();
    try {
      await secondContext.addCookies(medicoAuthCookies);
      const secondPage = await secondContext.newPage();

      await secondPage.goto(encounterPath);
      await expect(secondPage).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+/);
      await goToSection(secondPage, 'Observaciones');

      const secondTabNotes = secondPage.getByPlaceholder('Cualquier observación adicional relevante para el registro...');
      await secondTabNotes.fill('Observación persistida desde la segunda pestaña.');
      await secondPage.getByRole('button', { name: 'Guardar Ahora' }).click();
      await expect(
        secondPage.getByRole('status').filter({ hasText: /cambios guardados|guardado a las|sin cambios/i }),
      ).toBeVisible({ timeout: 10000 });

      await firstTabNotes.fill('Observación local stale desde la primera pestaña.');
      await page.getByRole('button', { name: 'Guardar Ahora' }).click();

      await expect(page.getByText('La copia local quedó protegida y lista para comparar.')).toBeVisible({
        timeout: 10000,
      });
      await expect(firstTabNotes).toHaveValue('Observación persistida desde la segunda pestaña.', { timeout: 10000 });
    } finally {
      await secondContext.close();
    }
  });

  test('complete and sign encounter clinically', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const warningMonitor = createRouterWarningMonitor(page);

    try {
      await loginAsMedico(page);
      await openEncounter(page);

      await goToSection(page, 'Examen físico');
      await page.getByPlaceholder('120/80').fill('120/80');
      await completeVisibleSection(page, 'Sospecha diagnóstica');

      await page.getByRole('button', { name: /agregar sospecha diagnóstica/i }).click();
      const diagnosisInput = page.getByPlaceholder('Diagnóstico sospechado...');
      await diagnosisInput.fill('Apendicitis aguda probable');
      await completeVisibleSection(page, 'Tratamiento');

      await page.getByTestId('medication-add-manual').click();
      await page.getByTestId('medication-manual-name').fill('Paracetamol');
      await completeVisibleSection(page, 'Respuesta al tratamiento');

      const closureTool = await openWorkspaceTool(page, 'Cierre');
      await closureTool.locator('#workspace-closure-note').fill(
        'Paciente estable al cierre. Se indican analgésicos, control y reevaluación precoz ante signos de alarma.',
      );

      await page.getByRole('button', { name: 'Finalizar Atención' }).click();
      const completionDialog = page.getByRole('alertdialog', { name: 'Finalizar atención' });
      await expect(completionDialog).toBeVisible({ timeout: 5000 });
      await completionDialog.getByRole('button', { name: 'Finalizar atención' }).click();

      await expect(page).toHaveURL(/\/atenciones\/[a-zA-Z0-9-]+\/ficha$/, { timeout: 15000 });
      await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Volver al inicio' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Firmar Atención' })).toBeVisible({ timeout: 10000 });

      await page.getByRole('button', { name: 'Firmar Atención' }).click();
      const signDialog = page.getByRole('dialog');
      await expect(page.getByRole('heading', { name: 'Firma Electrónica Simple' })).toBeVisible({ timeout: 5000 });
      await page.getByLabel('Contraseña de su cuenta').fill(MEDICO_PASSWORD);
      await signDialog.getByRole('button', { name: 'Firmar Atención' }).click();

      await expect(page.getByText('Firmada', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Atención firmada electrónicamente')).toBeVisible({ timeout: 10000 });
    } finally {
      warningMonitor.detach();
      const warningBody = warningMonitor.warnings.length
        ? warningMonitor.warnings.join('\n')
        : 'No router initialization warnings observed in this run.';
      testInfo.annotations.push({
        type: 'router-init-warning-count',
        description: String(warningMonitor.warnings.length),
      });
      await testInfo.attach('router-init-warning-monitor.txt', {
        body: warningBody,
        contentType: 'text/plain',
      });
    }
  });
});
