import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { createCloudHarness } from '../support/cloud.ts';

test('login validation leaves room above the password field', async ({ page }) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/login');
    await page.getByLabel('Email address').fill('invalid-email');
    await page.getByLabel('Password', { exact: true }).focus();
    const error = page.getByText('Enter a valid email address.', {
      exact: true,
    });
    await expect(error).toBeVisible();
    const password = page.locator('mat-form-field').filter({
      has: page.getByLabel('Password', { exact: true }),
    });
    await expect
      .poll(async () => {
        const a = await error.boundingBox(),
          b = await password.boundingBox();
        return a && b ? b.y - (a.y + a.height) : -1;
      })
      .toBeGreaterThanOrEqual(8);
  }
  await page.screenshot({
    path: 'artifacts/login-validation-mobile.png',
    fullPage: true,
  });
});

test('mobile sheet preserves the draft through dismissal and desktop resize', async ({ page }) => {
  test.setTimeout(60000);
  const h = await createCloudHarness('responsive-order');
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/login');
    const c = h.loginCredentials('legnicka');
    await page.getByLabel('Email address').fill(c.email);
    await page.getByLabel('Password', { exact: true }).fill(c.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2');
    const table = page.getByRole('table', { name: 'Salon stock', exact: true });
    await expect(
      table.getByRole('columnheader', { name: 'HQ available', exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole('row').filter({ hasText: 'Pomada Matowa' }).getByRole('cell').nth(2),
    ).toContainText('18');
    await expect(page.getByRole('heading', { name: 'HQ availability', exact: true })).toHaveCount(
      0,
    );
    await page.screenshot({
      path: 'artifacts/inventory-column-desktop.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 360, height: 800 });
    await page.getByRole('button', { name: 'Request Pomada Matowa', exact: true }).click();
    const sheet = page.getByRole('dialog', {
      name: 'Request products',
      exact: true,
    });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel('Quantity', { exact: true }).fill('3');
    await sheet.getByRole('button', { name: 'Add to list', exact: true }).click();
    await expect(sheet.getByLabel('Units for Pomada Matowa')).toHaveValue('3');
    await sheet.getByRole('button', { name: 'Close request products', exact: true }).click();
    await expect(sheet).toBeHidden();
    const trigger = page.getByRole('button', { name: /^Request products/ });
    await trigger.click();
    await expect(sheet.getByLabel('Units for Pomada Matowa')).toHaveValue('3');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(sheet).toBeHidden();
    await expect(page.getByLabel('Units for Pomada Matowa')).toHaveValue('3');
    await page.setViewportSize({ width: 320, height: 800 });
    const historyLink = page.getByRole('link', {
      name: 'View requests',
      exact: true,
    });
    await historyLink.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(trigger).toBeInViewport();
    const historyBounds = await historyLink.boundingBox();
    const triggerBounds = await trigger.boundingBox();
    expect(
      historyBounds && triggerBounds && historyBounds.y + historyBounds.height <= triggerBounds.y,
    ).toBe(true);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: 'artifacts/request-fab-mobile.png' });
    await trigger.click();
    await expect(sheet.getByLabel('Units for Pomada Matowa')).toHaveValue('3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: 'artifacts/request-sheet-mobile.png',
      fullPage: true,
    });
    await sheet.getByRole('button', { name: 'Submit request', exact: true }).click();
    await expect(sheet.getByText('Request submitted.', { exact: true })).toBeVisible({
      timeout: 20000,
    });
    await sheet.getByRole('link', { name: 'Open request', exact: true }).click();
    await expect(page).toHaveURL(/\/salons\/[^/]+\/requests\/[^/]+$/);
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('salon-on-hand')).toHaveText('2');
  } finally {
    await h.dispose();
  }
});
