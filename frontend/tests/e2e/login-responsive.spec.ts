import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gotoApp } from './helpers/navigation';

async function mockLoginApis(page: Page) {
  await page.route('**/api/auth/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasAdmin: true }),
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ requires2FA: true, tempToken: 'e2e-temp-token' }),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasOverflow).toBe(false);
}

async function expectVisibleWithinViewport(page: Page, selectorName: string) {
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const button = page.getByRole('button', { name: selectorName });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
}

async function expectNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const actionableViolations = results.violations.filter((violation) =>
    ['critical', 'serious'].includes(violation.impact || ''),
  );

  expect(actionableViolations).toEqual([]);
}

test.describe('login responsive safeguards', () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test('keeps credential and 2FA actions visible on a small mobile viewport', async ({ page }) => {
    await mockLoginApis(page);

    await gotoApp(page, '/login');
    await expect(page.getByLabel('Correo electrónico')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectVisibleWithinViewport(page, 'Iniciar sesión');
    await expect(page.locator('form').first()).toHaveAttribute('method', 'post');
    await expect(page.locator('form').first()).toHaveAttribute('novalidate', '');
    await expectNoSeriousAxeViolations(page);

    await page.waitForLoadState('networkidle');
    await page.getByLabel('Correo electrónico').fill('doc@test.cl');
    await page.getByLabel('Contraseña').fill('Password1');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await expect(page.getByRole('heading', { name: 'Verificación 2FA' })).toBeVisible();
    await expect(page.getByLabel('Código de verificación')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('form').first()).toHaveAttribute('method', 'post');
    await expect(page.locator('form').first()).toHaveAttribute('novalidate', '');
    await expectVisibleWithinViewport(page, 'Verificar código');
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
    await expectNoSeriousAxeViolations(page);
  });
});
