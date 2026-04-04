import { expect, test } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5555';

const medicoUser = {
  id: 'med-1',
  email: 'medico@anamneo.cl',
  nombre: 'Dra. Rivera',
  role: 'MEDICO',
  isAdmin: false,
  medicoId: null,
};

const encounterPayload = {
  id: 'enc-1',
  patientId: 'patient-1',
  createdById: 'med-1',
  status: 'EN_PROGRESO',
  reviewStatus: 'NO_REQUIERE_REVISION',
  createdAt: '2026-04-04T12:00:00.000Z',
  updatedAt: '2026-04-04T12:00:00.000Z',
  patient: {
    id: 'patient-1',
    rut: '11.111.111-1',
    rutExempt: false,
    rutExemptReason: null,
    nombre: 'Paciente Demo',
    edad: 44,
    sexo: 'FEMENINO',
    trabajo: null,
    prevision: 'FONASA',
    domicilio: null,
    createdAt: '2026-04-04T12:00:00.000Z',
    updatedAt: '2026-04-04T12:00:00.000Z',
  },
  createdBy: {
    id: 'med-1',
    nombre: 'Dra. Rivera',
  },
  sections: [
    {
      id: 'sec-identificacion',
      encounterId: 'enc-1',
      sectionKey: 'IDENTIFICACION',
      schemaVersion: 1,
      label: 'Identificación',
      order: 0,
      data: {
        nombre: 'Paciente Demo',
        rut: '11.111.111-1',
      },
      completed: true,
      updatedAt: '2026-04-04T12:00:00.000Z',
    },
    {
      id: 'sec-motivo',
      encounterId: 'enc-1',
      sectionKey: 'MOTIVO_CONSULTA',
      schemaVersion: 1,
      label: 'Motivo de Consulta',
      order: 1,
      data: {
        texto: '',
      },
      completed: false,
      updatedAt: '2026-04-04T12:00:00.000Z',
    },
  ],
  tasks: [],
};

test('recovers the local draft after 401, login and return to the encounter', async ({ context, page }) => {
  let shouldExpireOnSuggest = true;

  await context.addCookies([
    { name: 'access_token', value: 'test-access', url: baseURL },
    { name: 'refresh_token', value: 'test-refresh', url: baseURL },
  ]);

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(medicoUser),
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthorized', statusCode: 401 }),
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/conditions/suggest', async (route) => {
    if (shouldExpireOnSuggest) {
      shouldExpireOnSuggest = false;
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized', statusCode: 401 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/encounters/enc-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(encounterPayload),
    });
  });

  await page.route('**/api/encounters/stats/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalPatients: 1,
        activeEncounters: 1,
        completedEncounters: 0,
        overdueTasks: 0,
      }),
    });
  });

  await page.route('**/api/patients/patient-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'patient-1',
        nombre: 'Paciente Demo',
        rut: '11.111.111-1',
        rutExempt: false,
        rutExemptReason: null,
        edad: 44,
        sexo: 'FEMENINO',
        trabajo: null,
        prevision: 'FONASA',
        domicilio: null,
        createdAt: '2026-04-04T12:00:00.000Z',
        updatedAt: '2026-04-04T12:00:00.000Z',
        history: {},
        problems: [],
        tasks: [],
      }),
    });
  });

  await page.route('**/api/patients/patient-1/encounters?page=1&limit=1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [],
        pagination: {
          page: 1,
          limit: 1,
          total: 0,
          totalPages: 0,
        },
      }),
    });
  });

  await page.route('**/api/templates**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  const draftNote = 'Paciente relata cefalea pulsátil con fotofobia desde hace 3 días.';

  await page.goto('/atenciones/enc-1');
  await expect(page.getByText('Paciente Demo')).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { name: 'Motivo de Consulta' })).toBeVisible();

  const motivoTextarea = page.getByPlaceholder('Ej: Paciente refiere dolor de cabeza intenso de 3 días de evolución, que empeora con la luz...');
  await motivoTextarea.fill(draftNote);

  await page.waitForURL('**/login?from=*');
  await expect(page).toHaveURL(/\/login\?from=%2Fatenciones%2Fenc-1/);

  await page.getByLabel('Correo electrónico').fill('medico@anamneo.cl');
  await page.getByLabel('Contraseña').fill('Admin123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await page.waitForURL('**/atenciones/enc-1');
  await expect(page.getByRole('heading', { name: 'Motivo de Consulta' })).toBeVisible();
  await expect(motivoTextarea).toHaveValue(draftNote);
});