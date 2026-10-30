import { test, expect, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import {
  createDeliveryHarness,
  seedDispatchedDelivery,
  readDeliverySnapshot,
  type DeliveryHarness,
  type DeliverySnapshot,
} from '../support/delivery.ts';
import { seedDeliveryPdf } from './delivery.fixture.ts';
let h: DeliveryHarness, delivery: Awaited<ReturnType<typeof seedDispatchedDelivery>>;
let after: DeliverySnapshot, preview: string | null, posted: unknown[];
const evidence = '.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/screenshots';
async function login(page: Page) {
  await page.goto('/login');
  const credentials = h.loginCredentials('legnicka');
  await page.getByLabel('Email address').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Legnicka', exact: true }).waitFor();
}
async function open(page: Page) {
  await page.goto(`/salons/${h.legnickaId}/requests/${delivery.requestId}`);
  await page.getByRole('button', { name: 'Check delivery', exact: true }).click();
  await page.getByRole('heading', { name: 'Check delivery', exact: true }).waitFor();
}
async function fill(page: Page, good: string, damaged: string, missing = '0') {
  await page
    .getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true })
    .fill(good);
  await page
    .getByRole('spinbutton', { name: 'Damaged units · Pomada Matowa', exact: true })
    .fill(damaged);
  await page
    .getByRole('spinbutton', { name: 'Missing units · Pomada Matowa', exact: true })
    .fill(missing);
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Record inspection', exact: true }).click();
  await page.getByRole('heading', { name: 'Inspection recorded', exact: true }).waitFor();
  after = await readDeliverySnapshot(h);
}
test.describe('Feature: inspect a salon delivery and keep the evidence', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await mkdir(evidence, { recursive: true });
    h = undefined!;
    h = await createDeliveryHarness('receipt-browser');
    delivery = await seedDispatchedDelivery(h);
    posted = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/recordDeliveryReceipt'))
        posted.push(request.postDataJSON());
    });
    await login(page);
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });
  test.describe('Given ten dispatched units and two damaged jars', () => {
    test.beforeEach(async ({ page }) => {
      await open(page);
      await fill(page, '8', '2');
      await page.getByLabel('Describe the problem').fill('Two cracked jars');
      preview = await page
        .getByRole('region', { name: 'Receipt preview', exact: true })
        .textContent();
    });
    test.describe('When staff confirm the inspection', () => {
      test.beforeEach(async ({ page }) => {
        await save(page);
        await mkdir(evidence, { recursive: true });
        await page.screenshot({ path: `${evidence}/receipt-recorded.png`, fullPage: true });
      });
      test('Then only eight good units enter stock and one issue records the two damaged units', async () => {
        expect(preview).toContain('8 good units');
        expect(preview).toContain('2 units');
        expect(after.salonInventory.onHand).toBe(10);
        expect(after.hqInventory.onHand).toBe(8);
        expect(after.receipts).toHaveLength(1);
        expect(after.issues[0].items[0].initialAffectedQuantity).toBe(2);
        expect(
          after.movements.filter((row) => row.type === 'RECEIPT').map((row) => row.quantity),
        ).toEqual([8]);
        expect(posted).toHaveLength(1);
      });
    });
  });
  for (const scenario of [
    {
      name: 'all units are good',
      good: '10',
      damaged: '0',
      missing: '0',
      stock: 12,
      issues: 0,
      movements: 1,
    },
    {
      name: 'all units are missing',
      good: '0',
      damaged: '0',
      missing: '10',
      stock: 2,
      issues: 1,
      movements: 0,
    },
  ]) {
    test.describe(`Given ${scenario.name}`, () => {
      test.beforeEach(async ({ page }) => {
        await open(page);
        await fill(page, scenario.good, scenario.damaged, scenario.missing);
        if (scenario.issues)
          await page.getByLabel('Describe the problem').fill('No products in the parcel');
      });
      test.describe('When the inspection is recorded', () => {
        test.beforeEach(async ({ page }) => {
          await save(page);
        });
        test('Then the recorded facts match the good stock without zero movements', async () => {
          expect(after.salonInventory.onHand).toBe(scenario.stock);
          expect(after.issues).toHaveLength(scenario.issues);
          expect(after.movements.filter((row) => row.type === 'RECEIPT')).toHaveLength(
            scenario.movements,
          );
          expect(after.receiptItems[0].missingQuantity).toBe(Number(scenario.missing));
        });
      });
    });
  }
  test.describe('Given an incomplete classification', () => {
    test.beforeEach(async ({ page }) => {
      await open(page);
    });
    test.describe('When the entered quantities total eleven instead of ten', () => {
      test.beforeEach(async ({ page }) => {
        await fill(page, '8', '3');
        await page.getByLabel('Describe the problem').fill('Wrong sum');
        after = await readDeliverySnapshot(h);
      });
      test('Then confirmation is blocked and no inspection is submitted', async ({ page }) => {
        await expect(
          page.getByRole('button', { name: 'Record inspection', exact: true }),
        ).toBeDisabled();
        await expect(page.getByText(/must add up to 10/)).toBeVisible();
        expect(after.receipts).toEqual([]);
        expect(posted).toEqual([]);
      });
    });
  });
  test.describe('Given a draft and an assigned published procedure', () => {
    test.beforeEach(async ({ page }) => {
      const source = await seedDeliveryPdf(h);
      await page.route('**/getSourcePdf?*', (route) =>
        new URL(route.request().url()).searchParams.get('versionId') === source.versionId
          ? route.fulfill({ status: 200, contentType: 'application/pdf', body: source.bytes })
          : route.fulfill({ status: 404 }),
      );
      await open(page);
      await fill(page, '8', '2');
      await page.getByLabel('Describe the problem').fill('Two cracked jars');
      await page.getByLabel('Batch number (if known)').fill('LOT-42');
    });
    test.describe('When staff open the original PDF and return', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('button', { name: 'Open damaged product procedure', exact: true })
          .click();
        await page
          .getByRole('heading', { name: 'Delivery handling procedure', exact: true })
          .waitFor();
        await page.getByTestId('pdf-page-canvas').waitFor();
        await page.getByRole('button', { name: 'Back to Check delivery', exact: true }).click();
        await page.getByRole('heading', { name: 'Check delivery', exact: true }).waitFor();
        await page.screenshot({ path: `${evidence}/receipt-pdf-return.png`, fullPage: true });
      });
      test('Then quantities, description and batch remain in the same request', async ({
        page,
      }) => {
        await expect(page).toHaveURL(new RegExp(`${delivery.requestId}/receipt$`));
        await expect(
          page.getByRole('spinbutton', { name: 'Good units · Pomada Matowa', exact: true }),
        ).toHaveValue('8');
        await expect(
          page.getByRole('spinbutton', { name: 'Damaged units · Pomada Matowa', exact: true }),
        ).toHaveValue('2');
        await expect(page.getByLabel('Describe the problem')).toHaveValue('Two cracked jars');
        await expect(page.getByLabel('Batch number (if known)')).toHaveValue('LOT-42');
        expect(posted).toEqual([]);
      });
    });
  });
  test.describe('Given a committed inspection whose response is lost', () => {
    test.beforeEach(async ({ page }) => {
      await open(page);
      await fill(page, '8', '2');
      await page.getByLabel('Describe the problem').fill('Two cracked jars');
      let lost = false;
      await page.route('**/recordDeliveryReceipt', async (route) => {
        if (route.request().method() !== 'POST' || lost) return route.continue();
        lost = true;
        await route.fetch();
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { status: 'UNAVAILABLE', message: 'Controlled lost response' },
          }),
        });
      });
    });
    test.describe('When staff reload and retry the saved inspection', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Record inspection', exact: true }).click();
        await page.getByRole('button', { name: 'Retry saved inspection', exact: true }).waitFor();
        await page.reload();
        await page.getByRole('button', { name: 'Retry saved inspection', exact: true }).click();
        await page.getByRole('heading', { name: 'Inspection recorded', exact: true }).waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then the original key and payload reconcile exactly one receipt and issue', async () => {
        expect(posted).toHaveLength(2);
        expect(posted[1]).toEqual(posted[0]);
        expect(after.receipts).toHaveLength(1);
        expect(after.issues).toHaveLength(1);
        expect(after.commands).toHaveLength(1);
        expect(after.salonInventory.onHand).toBe(10);
      });
    });
  });
  for (const width of [320, 360, 1280]) {
    test.describe(`Given a ${width}px viewport`, () => {
      let violations: unknown[], overflow: number;
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page);
      });
      test.describe('When staff fill the inspection with the keyboard', () => {
        test.beforeEach(async ({ page }) => {
          const good = page.getByRole('spinbutton', {
            name: 'Good units · Pomada Matowa',
            exact: true,
          });
          await good.focus();
          await good.press('ControlOrMeta+A');
          await page.keyboard.type('8');
          await page.keyboard.press('Tab');
          await page.keyboard.press('ControlOrMeta+A');
          await page.keyboard.type('2');
          await page.getByLabel('Describe the problem').fill('Keyboard entry');
          violations = (await new AxeBuilder({ page }).analyze()).violations;
          overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          await page.screenshot({ path: `${evidence}/receipt-${width}.png`, fullPage: true });
        });
        test('Then the summary and controls remain usable without overflow or accessibility violations', async ({
          page,
        }) => {
          await expect(
            page.getByRole('button', { name: 'Record inspection', exact: true }),
          ).toBeEnabled();
          expect(violations).toEqual([]);
          expect(overflow).toBeLessThanOrEqual(0);
        });
      });
    });
  }
});
