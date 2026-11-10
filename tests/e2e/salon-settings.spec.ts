import { test, expect, type Page } from './test.ts';
import { AxeBuilder } from '@axe-core/playwright';
import { createCloudHarness } from '../support/cloud.ts';
let h: Awaited<ReturnType<typeof createCloudHarness>>;
test.beforeEach(async () => {
  h = await createCloudHarness('settings-ui');
});
test.afterEach(async () => {
  if (h) await h.dispose();
});
async function login(page: Page) {
  await page.goto('/login');
  const c = h.loginCredentials('hq');
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salon requests', exact: true })).toBeVisible();
}
async function axe(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
}
test('settings_persist_and_workspace_switch_starts_at_inventory_without_threshold_leak', async ({
  page,
}) => {
  test.setTimeout(60000);
  await login(page);
  const path = `/salons/${encodeURIComponent(h.legnickaId)}`;
  await page.goto(path);
  await expect(page.getByTestId('low-stock-NBS-MATOWA-100')).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Low-stock threshold')).toHaveValue('2');
  await page.getByLabel('Low-stock threshold').fill('1');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Low-stock threshold')).toHaveValue('1');
  await axe(page);
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2');
  await expect(page.getByTestId('low-stock-NBS-MATOWA-100')).toHaveCount(0);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Workspace' }).click();
  await page.getByRole('option', { name: 'Salon — Łódzka', exact: true }).click();
  await expect(page).toHaveURL(/lodzka$/);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Low-stock threshold')).toHaveValue('2');
  await page.getByLabel('Low-stock threshold').fill('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Settings saved.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByTestId('low-stock-NBS-MATOWA-100')).toHaveCount(0);
  await page.goto(path + '/settings');
  await expect(page.getByLabel('Low-stock threshold')).toHaveValue('1');
  for (const width of [1280, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await axe(page);
  }
  await page.getByLabel('Low-stock threshold').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  await page.screenshot({
    path: 'artifacts/settings-mobile.png',
    fullPage: true,
  });
  await page.goto(path + '/requests');
  await expect(page.getByRole('heading', { name: 'Requests', exact: true })).toBeVisible();
  await axe(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Inventory', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Requests', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Legnicka', exact: true })).toHaveCount(0);
});
test('failed_setting_read_does_not_invent_low_stock_warnings', async ({ page }) => {
  await page.route('**:9399/**', async (route) => {
    if (route.request().postData()?.includes('GetSalonSettings')) await route.abort();
    else await route.continue();
  });
  await login(page);
  await page.goto(`/salons/${encodeURIComponent(h.legnickaId)}`);
  await expect(page.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2');
  await expect(page.getByText('Low-stock warnings unavailable.', { exact: false })).toBeVisible();
  await expect(page.getByTestId('low-stock-NBS-MATOWA-100')).toHaveCount(0);
});
