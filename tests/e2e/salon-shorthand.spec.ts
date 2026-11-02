import { test, expect, type Page } from '@playwright/test';
import { getAuth } from 'firebase-admin/auth';
import { createCloudHarness } from '../support/cloud.ts';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { createReplenishmentPreparer } from '../../functions/src/ai/replenishment.ts';
import { createReplenishmentRepository } from '../../functions/src/ai/replenishment-repository.ts';
import { createSalonAliasCommands } from '../../functions/src/ai/salon-alias-commands.ts';

/**
 * Browser acceptance against actual preparation and shorthand services on isolated SQL.
 * Only extraction is deterministic ("N phrase" items); no provider is called.
 */
let h: Awaited<ReturnType<typeof createCloudHarness>>;
const items = (message: string) =>
  message.split(', ').map((originalWording) => {
    const [n, ...rest] = originalWording.split(' ');
    return { originalWording, productQuery: rest.join(' '), quantity: Number(n) };
  });
async function serve(page: Page) {
  const auth = getAuth(h.operator.app);
  const commands = createSalonAliasCommands(h.operator);
  const prepare = createReplenishmentPreparer({
    resolveActor: async (uid) => {
      const role = Object.entries(h.users).find(([, u]) => u === uid)?.[0];
      return role === 'hq'
        ? { uid, businessId: h.businessId, role: 'HQ', salonIds: [] }
        : { uid, businessId: h.businessId, role: 'SALON', salonIds: [`${h.businessId}:${role}`] };
    },
    admitAiCall: async () => createAiBudget(Date.now()),
    repository: createReplenishmentRepository(h.operator),
    shorthand: commands,
    generate: async (_b, input, tools) => {
      await tools.calculateProposal(items(input.message));
      return { items: items(input.message) };
    },
  });
  const operations: Record<string, (uid: string, data: never) => Promise<unknown>> = {
    prepareReplenishment: (uid, data) => prepare(uid, data),
    removeSalonShorthand: (uid, data) => commands.remove(uid, data),
  };
  for (const router of ['commands', 'ai'])
    await page.route(`**/${router}`, async (route) => {
      const headers = {
        'access-control-allow-origin': new URL(page.url()).origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers':
          'authorization, content-type, firebase-instance-id-token, x-firebase-appcheck',
      };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const { op, input } = route.request().postDataJSON().data;
      if (!(op in operations)) return route.fallback();
      const token = route.request().headers()['authorization']?.slice(7) ?? '';
      try {
        const { uid } = await auth.verifyIdToken(token, true);
        const result = await operations[op](uid, input as never);
        await route.fulfill({
          status: 200,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ result }),
        });
      } catch (error) {
        const code = String((error as { code?: string }).code ?? 'SERVICE_UNAVAILABLE');
        const status =
          code === 'FORBIDDEN'
            ? 'PERMISSION_DENIED'
            : code === 'SOURCE_CHANGED'
              ? 'ABORTED'
              : 'UNAVAILABLE';
        await route.fulfill({
          status: 400,
          headers,
          contentType: 'application/json',
          body: JSON.stringify({ error: { status, message: code, details: { code } } }),
        });
      }
    });
}
async function login(page: Page, role: 'hq' | 'legnicka' | 'lodzka') {
  await page.goto('/login');
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
async function ask(page: Page, salon: string, message: string) {
  await page.goto(`/salons/${encodeURIComponent(salon)}`);
  if ((page.viewportSize()?.width ?? 1280) < 760)
    await page.getByRole('button', { name: 'Request products', exact: true }).click();
  await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
  await page.getByLabel(/what do you need/i).fill(message);
  await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
}

test.describe('Feature: salon shorthand learned from explicit choices', () => {
  test.beforeEach(async () => {
    test.setTimeout(120000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Only isolated emulator fixtures are allowed');
    h = await createCloudHarness('shorthand-browser');
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });
  for (const width of [1280, 320])
    test(`learns, applies, removes and stays salon-scoped at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await serve(page);
      await login(page, 'legnicka');
      await ask(page, h.legnickaId, '3 pasta');
      await page.getByRole('combobox', { name: 'Product for 3 pasta' }).press('Enter');
      await expect(page.getByRole('option')).toHaveCount(6);
      await page.getByRole('option', { name: 'Pomada Cement', exact: true }).click();
      await page.getByRole('button', { name: 'Use selection', exact: true }).click();
      await expect(
        page.getByText('Saved as salon shorthand. You can remove it in Settings.'),
      ).toBeVisible();
      await ask(page, h.legnickaId, '2 pasta');
      await expect(
        page.getByText('Proposal added. Review quantities, then submit the request.'),
      ).toBeVisible();
      await page.goto(`/salons/${encodeURIComponent(h.legnickaId)}/settings`);
      await expect(page.getByText('pasta → Pomada Cement')).toBeVisible();
      await page.getByLabel('Low-stock threshold').fill('5');
      await page.getByRole('button', { name: 'Remove shorthand pasta', exact: true }).click();
      await expect(page.getByText('No salon shorthand yet.', { exact: false })).toBeVisible();
      await expect(page.getByLabel('Low-stock threshold')).toHaveValue('5');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await ask(page, h.legnickaId, '2 pasta');
      await expect(page.getByText('Review the unresolved items below.')).toBeVisible();
    });
  test('keeps other salons unaffected and HQ read-only', async ({ page, browser }) => {
    await serve(page);
    await login(page, 'legnicka');
    await ask(page, h.legnickaId, '3 pasta');
    await page.getByRole('combobox', { name: 'Product for 3 pasta' }).press('Enter');
    await page.getByRole('option', { name: 'Pomada Cement', exact: true }).click();
    await page.getByRole('button', { name: 'Use selection', exact: true }).click();
    await expect(
      page.getByText('Saved as salon shorthand. You can remove it in Settings.'),
    ).toBeVisible();
    const other = await browser.newPage();
    await serve(other);
    await login(other, 'lodzka');
    await ask(other, `${h.businessId}:lodzka`, '2 pasta');
    await expect(other.getByText('Review the unresolved items below.')).toBeVisible();
    const hq = await browser.newPage();
    await login(hq, 'hq');
    await hq.goto('/hq/shorthand');
    await expect(hq.getByText('Legnicka')).toBeVisible();
    await expect(hq.getByText('pasta → Pomada Cement')).toBeVisible();
    await expect(hq.getByRole('button', { name: /Remove/ })).toHaveCount(0);
  });
});
