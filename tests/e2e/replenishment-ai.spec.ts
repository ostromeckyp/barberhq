import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { createCloudHarness } from '../support/cloud.ts';
import type { ProposalResult } from '../../shared/contracts/ai/index.ts';

let h: Awaited<ReturnType<typeof createCloudHarness>>;
let extra: BrowserContext | undefined;
const ready = (): ProposalResult['lines'][number] => ({
  status: 'READY',
  lineId: 'line-0-8',
  productId: `${h.businessId}:NBS-MATOWA-100`,
  productName: 'Pomada Matowa',
  quantity: 2,
  origin: 'assistant',
  hqAvailable: 18,
  salonOnHand: 2,
  hqInventoryVersion: 1,
  salonInventoryVersion: 1,
});
async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: role === 'hq' ? 'Salon requests' : 'Legnicka', exact: true }),
  ).toBeVisible();
}
async function panel(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 760)
    await page.getByRole('button', { name: 'Request products', exact: true }).click();
  await page.getByRole('tab', { name: 'Assistant', exact: true }).click();
}
async function respond(
  page: Page,
  result: () =>
    ProposalResult | { error: { status: string; message: string; details: { code: string } } },
) {
  await page.route('**/ai', async (route) => {
    const headers = {
      'access-control-allow-origin': new URL(page.url()).origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers':
        'authorization, content-type, firebase-instance-id-token, x-firebase-appcheck',
    };
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (route.request().postDataJSON().data.op !== 'prepareReplenishment') return route.fallback();
    const value = result();
    await route.fulfill({
      status: 'error' in value ? 429 : 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify('error' in value ? value : { result: value }),
    });
  });
}
async function confirm(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name, exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
}
test.describe('Feature: editable ordering assistant', () => {
  test.beforeEach(async () => {
    test.setTimeout(120000);
    if (process.env.BARBERHQ_TEST_MODE !== 'emulator' || process.env.BARBERHQ_TEST_CONFIG)
      throw Error('Only isolated emulator fixtures are allowed');
    h = await createCloudHarness('ordering-ai-browser');
  });
  test.afterEach(async () => {
    if (extra) {
      await extra.close();
      extra = undefined;
    }
    if (h) await h.dispose();
  });
  test.describe('Given a verified two-unit proposal', () => {
    test.beforeEach(async ({ page }) => {
      await respond(page, () => ({
        status: 'PROPOSAL',
        lines: [ready()],
        excluded: [],
        toolEvents: [],
      }));
      await login(page, 'legnicka');
      await panel(page);
    });
    test.describe('When staff review and explicitly submit it through the ordinary workflow', () => {
      test.beforeEach(async ({ page, browser }) => {
        await page.getByLabel('What do you need?').fill('2 Matowa');
        await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
        await expect(page.getByLabel('Units for Pomada Matowa')).toHaveValue('2');
        expect((await h.inventory()).hqOnHand).toBe(18);
        const before = await h.operator.executeGraphql<
          { replenishmentRequests: unknown[] },
          Record<string, string>
        >('query($id:String!){replenishmentRequests(where:{businessId:{eq:$id}}){id}}', {
          variables: { id: h.businessId },
        });
        expect(before.data.replenishmentRequests).toHaveLength(0);
        expect(
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
            .violations,
        ).toEqual([]);
        await page.getByRole('button', { name: 'Submit request', exact: true }).click();
        await expect(page.getByText('Request submitted.', { exact: true })).toBeVisible({
          timeout: 20000,
        });
        await page.getByRole('link', { name: 'Open request', exact: true }).click();
        await expect(page).toHaveURL(/\/requests\/[^/]+$/);
        const id = page.url().split('/').at(-1)!;
        extra = await browser.newContext();
        const hq = await extra.newPage();
        await login(hq, 'hq');
        await hq.goto(`/hq/requests/${id}`);
        await confirm(hq, 'Approve request');
        await confirm(hq, 'Confirm dispatch');
        await page.reload();
        await page.getByRole('button', { name: 'Check delivery', exact: true }).click();
        await page
          .getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true })
          .fill('2');
        await page.getByRole('button', { name: 'Record inspection', exact: true }).click();
        await page.getByRole('heading', { name: 'Inspection recorded', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Back to request', exact: true }).click();
        await page.getByTestId('in-transit').waitFor();
      });
      test('Then two units move once and the request is fully received', async ({ page }) => {
        const snapshot = await h.operator.executeGraphql<
          {
            inventories: { locationId: string; onHand: number; reserved: number }[];
            stockMovements: { quantity: number }[];
            replenishmentRequests: { state: string }[];
          },
          Record<string, string>
        >(
          'query($id:String!,$product:String!){inventories(where:{productId:{eq:$product}}){locationId onHand reserved}stockMovements(where:{businessId:{eq:$id}}){quantity}replenishmentRequests(where:{businessId:{eq:$id}}){state}}',
          { variables: { id: h.businessId, product: `${h.businessId}:NBS-MATOWA-100` } },
        );
        expect(
          snapshot.data.inventories.find((i) => i.locationId === `${h.businessId}:hq`),
        ).toMatchObject({ onHand: 16, reserved: 0 });
        expect(snapshot.data.inventories.find((i) => i.locationId === h.legnickaId)).toMatchObject({
          onHand: 4,
          reserved: 0,
        });
        expect(snapshot.data.stockMovements).toHaveLength(2);
        expect(snapshot.data.replenishmentRequests).toEqual([{ state: 'RECEIVED' }]);
        await expect(page.getByTestId('in-transit')).toHaveText('0');
      });
    });
  });
  test.describe('Given a mixed ready and ambiguous proposal', () => {
    test.beforeEach(async ({ page }) => {
      let calls = 0;
      await respond(page, () =>
        ++calls === 1
          ? {
              status: 'NEEDS_CLARIFICATION',
              lines: [
                ready(),
                {
                  status: 'NEEDS_CLARIFICATION',
                  lineId: 'line-10-17',
                  originalWording: '2 matte',
                  reason: 'Choose a catalog product.',
                  origin: 'assistant',
                  quantity: 2,
                  candidates: [
                    {
                      productId: `${h.businessId}:NBS-DRYMATT-100`,
                      productName: 'Pomada Dry Matt',
                    },
                  ],
                },
              ],
              excluded: [],
              toolEvents: [],
            }
          : {
              status: 'PROPOSAL',
              lines: [
                ready(),
                {
                  ...ready(),
                  lineId: 'line-10-17',
                  productId: `${h.businessId}:NBS-DRYMATT-100`,
                  productName: 'Pomada Dry Matt',
                },
              ],
              excluded: [],
              toolEvents: [],
            },
      );
      await login(page, 'legnicka');
      await panel(page);
      await page.getByLabel('What do you need?').fill('2 Matowa, 2 matte');
      await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Submit request', exact: true }),
      ).toBeDisabled();
    });
    test.describe('When staff inspect the unresolved card', () => {
      test('Then it has the same origin and remove header as a resolved card', async ({ page }) => {
        const card = page.locator('.draft-line').filter({ hasText: 'Choose a catalog product.' });
        await expect(card.locator('.line-header')).toContainText('2 matte');
        await expect(card.locator('.line-header')).toContainText('From assistant');
        await expect(
          card.getByRole('button', { name: 'Remove 2 matte', exact: true }),
        ).toBeEnabled();
        await expect(
          page.getByRole('button', { name: 'Submit request', exact: true }),
        ).toBeDisabled();
      });
    });
    test.describe('When staff resolve the ambiguous item', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Use selection', exact: true }).click();
      });
      test('Then successful rows are not duplicated and the complete list can be submitted', async ({
        page,
      }) => {
        await expect(page.getByLabel('Units for Pomada Matowa')).toHaveValue('2');
        await expect(page.getByLabel('Units for Pomada Dry Matt')).toHaveValue('2');
        await expect(
          page.getByRole('button', { name: 'Submit request', exact: true }),
        ).toBeEnabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: `artifacts/replenishment-eval/assistant-${page.viewportSize()?.width ?? 1280}.png`,
          fullPage: true,
        });
      });
    });
  });
  test.describe('Given the shared AI quota is exhausted', () => {
    test.beforeEach(async ({ page }) => {
      await respond(page, () => ({
        error: {
          status: 'RESOURCE_EXHAUSTED',
          message: 'RATE_LIMITED',
          details: { code: 'RATE_LIMITED' },
        },
      }));
      await login(page, 'legnicka');
      await panel(page);
    });
    test.describe('When preparation fails and staff return to Manual', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByLabel('What do you need?').fill('2 Matowa');
        await page.getByRole('button', { name: 'Prepare proposal', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Use Manual');
        await page.getByRole('tab', { name: 'Manual', exact: true }).click();
        await page.getByLabel('Product', { exact: true }).click();
        await page.getByRole('option', { name: 'Pomada Matowa', exact: true }).click();
        await page.getByLabel('Quantity', { exact: true }).fill('5');
        await page.getByRole('button', { name: 'Add to list', exact: true }).click();
      });
      test('Then the manual path remains usable', async ({ page }) => {
        await expect(page.getByLabel('Units for Pomada Matowa')).toHaveValue('5');
        await expect(
          page.getByRole('button', { name: 'Submit request', exact: true }),
        ).toBeEnabled();
      });
    });
  });
});
