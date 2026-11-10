import { test, expect, type Page } from './test.ts';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';

async function accessibleCompact(page: Page) {
  await expect(page.getByRole('table')).toHaveCount(0);
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
}

test('compact lists retain stock, request status and workspace-specific navigation', async ({
  page,
}) => {
  test.setTimeout(60000);
  const h = await createCloudHarness('compact-grids');
  try {
    const repo = new StockRepository(h.operator);
    const pending = await repo.execute(h.users.legnicka, {
      type: 'SUBMIT',
      input: {
        salonId: h.legnickaId,
        idempotencyKey: randomUUID(),
        items: [
          { productId: `${h.businessId}:NBS-CEMENT-100`, quantity: 1 },
          { productId: `${h.businessId}:NBS-DRYMATT-100`, quantity: 2 },
          { productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 3 },
        ],
      },
    });
    const rejected = await repo.execute(h.users.legnicka, {
      type: 'SUBMIT',
      input: {
        salonId: h.legnickaId,
        idempotencyKey: randomUUID(),
        items: [{ productId: `${h.businessId}:NBS-SOL-200`, quantity: 1 }],
      },
    });
    await repo.execute(h.users.hq, {
      type: 'REJECT',
      input: {
        requestId: rejected.requestId,
        expectedRevision: 1,
        idempotencyKey: randomUUID(),
        reason: 'Demo rejection',
      },
    });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/login');
    const c = h.loginCredentials('hq');
    await page.getByLabel('Email address').fill(c.email);
    await page.getByLabel('Password', { exact: true }).fill(c.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const pendingRecord = page
      .getByRole('list', { name: 'Requests', exact: true })
      .getByRole('listitem')
      .filter({ hasText: pending.requestId.slice(0, 8) });
    await expect(pendingRecord).toContainText('Pending approval');
    await expect(pendingRecord.locator('dd')).toHaveText(['3', /6\s*pcs/]);
    await expect(pendingRecord).toContainText('+1 more');
    await accessibleCompact(page);
    await page.screenshot({
      path: 'artifacts/compact-hq-requests.png',
      fullPage: true,
    });
    await pendingRecord.getByRole('link', { name: 'Open request', exact: true }).click();
    await expect(page).toHaveURL(`/hq/requests/${pending.requestId}`);
    await expect(page.getByRole('button', { name: 'Approve request', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to request queue' }).click();
    await expect(page).toHaveURL(/\/hq(?:\?|$)/);

    await page.goto('/hq/stock');
    const hq = page.getByRole('list', { name: 'HQ stock', exact: true });
    await expect(hq.getByRole('listitem')).toHaveCount(6);
    await expect(hq.getByTestId('hq-stock-NBS-MATOWA-100').locator('dd')).toHaveText([
      '18',
      '0',
      '18',
    ]);
    await accessibleCompact(page);
    await page.screenshot({
      path: 'artifacts/compact-hq-stock.png',
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole('table', { name: 'HQ stock', exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'HQ stock', exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/salons/${h.legnickaId}`);
    const inventory = page.getByRole('list', {
      name: 'Salon stock',
      exact: true,
    });
    await expect(inventory.getByRole('listitem')).toHaveCount(6);
    await expect(inventory.getByTestId('stock-NBS-MATOWA-100')).toHaveText('2');
    const product = inventory.getByRole('listitem').filter({ hasText: 'Pomada Matowa' });
    await expect(product).toContainText('HQ available');
    await expect(product).toContainText('18');
    await expect(product.getByTestId('low-stock-NBS-MATOWA-100')).toBeVisible();
    await accessibleCompact(page);
    await page.screenshot({
      path: 'artifacts/compact-salon-stock.png',
      fullPage: true,
    });
    await product.getByRole('button', { name: 'Request Pomada Matowa', exact: true }).click();
    const sheet = page.getByRole('dialog', {
      name: 'Request products',
      exact: true,
    });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'Close request products', exact: true }).click();
    await page.getByRole('link', { name: 'View requests', exact: true }).click();
    const requests = page.getByRole('list', { name: 'Requests', exact: true });
    await expect(requests.getByRole('listitem')).toHaveCount(2);
    const rejectedRecord = requests
      .getByRole('listitem')
      .filter({ hasText: rejected.requestId.slice(0, 8) });
    await expect(rejectedRecord).toContainText('Rejected');
    await accessibleCompact(page);
    await page.screenshot({
      path: 'artifacts/compact-salon-requests.png',
      fullPage: true,
    });
    await rejectedRecord.getByRole('link', { name: 'Open request', exact: true }).click();
    await expect(page).toHaveURL(`/salons/${h.legnickaId}/requests/${rejected.requestId}`);
    await expect(page.getByRole('button', { name: 'Approve request', exact: true })).toHaveCount(0);
  } finally {
    await h.dispose();
  }
});
