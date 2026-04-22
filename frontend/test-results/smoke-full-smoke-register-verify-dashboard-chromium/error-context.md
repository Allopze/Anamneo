# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> full smoke: register, verify dashboard
- Location: tests/e2e/smoke.spec.ts:10:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('Token de instalación')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e7]: Anamneo
        - paragraph [ref=e8]: Invitación
        - heading "Activa tu cuenta para operar." [level=1] [ref=e9]
        - generic [ref=e10]:
          - generic [ref=e11]:
            - img [ref=e12]
            - text: Invitación
          - generic [ref=e15]:
            - img [ref=e16]
            - text: Rol asignado
          - generic [ref=e18]:
            - img [ref=e19]
            - text: Trazabilidad
    - main [ref=e22]:
      - generic [ref=e23]:
        - generic [ref=e24]:
          - paragraph [ref=e25]: Registro
          - heading "Crear cuenta" [level=2] [ref=e26]
          - paragraph [ref=e27]: Completa los datos para habilitar el acceso.
        - generic [ref=e28]:
          - generic [ref=e29]:
            - img [ref=e30]
            - text: Invitación validada
          - generic [ref=e32]:
            - img [ref=e33]
            - text: Rol fijado
        - generic [ref=e36]:
          - generic [ref=e37]: Necesita una invitación válida para crear una cuenta.
          - generic [ref=e38]:
            - generic [ref=e39]: Nombre completo
            - generic [ref=e40]:
              - img [ref=e41]
              - textbox "Nombre completo" [ref=e44]:
                - /placeholder: Dra. Camila Soto
                - text: Admin E2E
          - generic [ref=e45]:
            - generic [ref=e46]: Correo electrónico
            - generic [ref=e47]:
              - img [ref=e48]
              - textbox "Correo electrónico" [ref=e51]:
                - /placeholder: equipo@clinica.cl
                - text: admin+1776831291790-mawq9o@e2e-test.local
          - generic [ref=e52]:
            - generic [ref=e53]: Rol
            - paragraph [ref=e54]: Solo esta alta inicial habilita la cuenta administradora base.
          - generic [ref=e55]:
            - generic [ref=e56]:
              - generic [ref=e57]: Contraseña
              - generic [ref=e58]:
                - img [ref=e59]
                - textbox "Contraseña" [ref=e62]:
                  - /placeholder: ••••••••
                  - text: TestPass123!
                - button "Mostrar contraseña" [ref=e63] [cursor=pointer]:
                  - img [ref=e64]
              - paragraph [ref=e67]: Mínimo 8 caracteres, una mayúscula, una minúscula y un número.
            - generic [ref=e68]:
              - generic [ref=e69]: Confirmar contraseña
              - generic [ref=e70]:
                - img [ref=e71]
                - textbox "Confirmar contraseña" [active] [ref=e74]:
                  - /placeholder: ••••••••
                  - text: TestPass123!
                - button "Mostrar confirmación de contraseña" [ref=e75] [cursor=pointer]:
                  - img [ref=e76]
          - button "Crear cuenta" [disabled]:
            - img
            - text: Crear cuenta
        - paragraph [ref=e80]:
          - text: ¿Ya tienes cuenta?
          - link "Iniciar sesión" [ref=e81] [cursor=pointer]:
            - /url: /login
            - text: Iniciar sesión
            - img [ref=e82]
  - button "Open Next.js Dev Tools" [ref=e89] [cursor=pointer]:
    - img [ref=e90]
  - alert [ref=e93]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { ADMIN_EMAIL, ADMIN_NOMBRE, ADMIN_PASSWORD, BOOTSTRAP_TOKEN } from './e2e-identities';
  3  | 
  4  | /**
  5  |  * Smoke E2E tests that exercise the full stack: Playwright → Next.js → NestJS → SQLite.
  6  |  *
  7  |  * The backend is started via Playwright webServer config with a dedicated test DB.
  8  |  */
  9  | 
  10 | test('full smoke: register, verify dashboard', async ({ page }) => {
  11 |   test.setTimeout(60_000);
  12 | 
  13 |   // --- Register ---
  14 |   await page.goto('/register');
  15 |   await page.getByLabel('Nombre completo').fill(ADMIN_NOMBRE);
  16 |   await page.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  17 |   await page.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
  18 |   await page.getByLabel('Confirmar contraseña').fill(ADMIN_PASSWORD);
> 19 |   await page.getByLabel('Token de instalación').fill(BOOTSTRAP_TOKEN);
     |                                                 ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  20 |   await page.getByRole('button', { name: /Crear cuenta/i }).click();
  21 | 
  22 |   // Should land on dashboard with sidebar
  23 |   const sidebar = page.getByRole('navigation', { name: 'Navegación principal' });
  24 |   await expect(sidebar).toBeVisible({ timeout: 15000 });
  25 | 
  26 |   // Verify sidebar contains expected navigation links for ADMIN role
  27 |   await expect(sidebar.getByRole('link', { name: /pacientes/i })).toBeVisible();
  28 |   await expect(sidebar.getByRole('link', { name: /ajustes/i })).toBeVisible();
  29 | });
  30 | 
  31 | test('private route redirects to login when unauthenticated', async ({ page }) => {
  32 |   await page.goto('/pacientes');
  33 |   await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  34 | });
  35 | 
```