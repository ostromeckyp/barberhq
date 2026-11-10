import { test, expect, type Page } from './test.ts';
import { createCloudHarness } from '../support/cloud.ts';
let h: Awaited<ReturnType<typeof createCloudHarness>>;
test.beforeEach(async () => {
  h = await createCloudHarness('browser');
});
test.afterEach(async () => {
  if (h) await h.dispose();
});
async function login(page: Page) {
  await page.goto('/login');
  const credentials = h.loginCredentials('legnicka');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Legnicka', exact: true })).toBeVisible();
}
async function chooseInAccountMenu(page: Page, accountMenu: string, language: string) {
  await page.getByRole('button', { name: accountMenu }).click();
  await page.getByRole('menuitem', { name: /^language$|^język$/i }).click();
  await page.getByRole('menuitemradio', { name: language }).click();
}
test('salon user switches to Polish and keeps it after reload', async ({ page }) => {
  await login(page);
  await chooseInAccountMenu(page, 'Account menu', 'Polski');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.getByRole('button', { name: 'Menu konta' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.getByRole('button', { name: 'Menu konta' })).toBeVisible();
  await chooseInAccountMenu(page, 'Menu konta', 'English');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
});
test('login page language switch', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('app-language-select mat-select').click();
  await page.getByRole('option', { name: 'Polski' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.getByLabel('Adres e-mail')).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await page.locator('app-language-select mat-select').click();
  await page.getByRole('option', { name: 'English' }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
});
test('switch keeps a typed order draft', async ({ page }) => {
  await login(page);
  if ((page.viewportSize()?.width ?? 1280) < 760)
    await page.getByRole('button', { name: 'Request products', exact: true }).click();
  await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
  const message = page.locator('app-order-panel textarea');
  await message.fill('We need two more matte pomades');
  await chooseInAccountMenu(page, 'Account menu', 'Polski');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.locator('app-order-panel textarea')).toHaveValue(
    'We need two more matte pomades',
  );
});
