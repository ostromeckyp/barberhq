import { test, expect, type Page } from '@playwright/test';
import { getAuth } from 'firebase-admin/auth';
import { createCloudHarness } from '../support/cloud.ts';
import { createProductAdminCommands } from '../../functions/src/products/commands.ts';
import { createProductAliasCommands } from '../../functions/src/products/aliases.ts';
import { KnowledgeError } from '../../functions/src/knowledge/repository.ts';

/**
 * Browser acceptance of the HQ product screen against the actual product/alias commands on
 * isolated SQL. Card attachment needs Storage + extraction and is covered by SQL integration.
 */
let h: Awaited<ReturnType<typeof createCloudHarness>>;
async function serve(page: Page) {
  const auth = getAuth(h.operator.app);
  const admin = createProductAdminCommands(h.operator);
  const aliases = createProductAliasCommands(h.operator);
  const operations: Record<
    string,
    (uid: string, data: Record<string, unknown>) => Promise<unknown>
  > = {
    getProductAdmin: (uid, d) => admin.read(uid, String(d.productId)),
    createProduct: (uid, d) => admin.create(uid, d),
    updateProduct: (uid, d) => admin.update(uid, d),
    setHqStock: (uid, d) => admin.setHqStock(uid, d),
    listProductAliases: (uid, d) => aliases.list(uid, String(d.productId)),
    saveProductAliases: (uid, d) => aliases.save(uid, d),
    getProductCardAttachment: async () => {
      throw new KnowledgeError('NOT_FOUND');
    },
  };
  for (const name of Object.keys(operations))
    await page.route(`**/${name}`, async (route) => {
      const headers = {
        'access-control-allow-origin': new URL(page.url()).origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers':
          'authorization, content-type, firebase-instance-id-token, x-firebase-appcheck',
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      try {
        const { uid } = await auth.verifyIdToken(
          route.request().headers()['authorization']?.slice(7) ?? '',
          true,
        );
        const result = await operations[name](uid, route.request().postDataJSON().data);
        await route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ result }),
        });
      } catch (error) {
        const code = String((error as { code?: string }).code ?? 'OUTCOME_UNKNOWN');
        await route.fulfill({
          status: 400,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { status: 'FAILED_PRECONDITION', message: code, details: { code } },
          }),
        });
      }
    });
}
async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

test.describe('Feature: HQ adds and edits products', () => {
  test.beforeEach(async () => {
    test.setTimeout(120000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Only isolated emulator fixtures are allowed');
    h = await createCloudHarness('hq-products-browser');
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });
  for (const width of [1280, 320])
    test(`adds a product, sets HQ quantity and aliases at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await serve(page);
      await login(page, 'hq');
      await page.goto('/hq/stock');
      await page.getByRole('link', { name: 'Add product', exact: true }).click();
      const fill = async (label: string, value: string) =>
        page.getByLabel(label, { exact: true }).fill(value);
      await fill('Name', 'Pomada Testowa');
      await fill('Brand', 'Not Bad Stuff');
      await page.getByRole('combobox', { name: 'Category' }).click();
      await page.getByRole('option', { name: 'Pomady', exact: true }).click();
      await fill('Type (optional)', 'pomada');
      await fill('Product code', `T-${width}`);
      await fill('Net content (ml)', '100');
      await fill('Retail price (grosz)', '5900');
      await fill('Source URL', 'https://example.com/testowa');
      await fill('Observed on', '2026-10-28');
      await fill('Description', 'Test product.');
      await fill('HQ quantity', '7');
      await page.getByRole('button', { name: 'Add product', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Edit product' })).toBeVisible();
      await expect(page.getByText('Reserved for salon deliveries: 0 · Available: 7')).toBeVisible();
      await page.getByLabel('On hand at HQ').fill('12');
      await page.getByRole('button', { name: 'Save quantity', exact: true }).click();
      await expect(page.getByText('HQ quantity saved.')).toBeVisible();
      await page.getByLabel('New alias').fill('testowka');
      await page.getByRole('button', { name: 'Add alias', exact: true }).click();
      await expect(page.getByText('Manual', { exact: true })).toBeVisible();
      await page.getByLabel('New alias').fill('pomada cement');
      await page.getByRole('button', { name: 'Add alias', exact: true }).click();
      await expect(page.getByText('also matches: Pomada Cement')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.goto('/hq/stock');
      await expect(page.getByRole('link', { name: 'Pomada Testowa' }).first()).toBeVisible();
    });
  test('salon staff cannot open the product screen', async ({ page }) => {
    await serve(page);
    await login(page, 'legnicka');
    await page.goto('/hq/stock/products/new');
    await expect(page.getByRole('heading', { name: 'Add product' })).toHaveCount(0);
  });
});
