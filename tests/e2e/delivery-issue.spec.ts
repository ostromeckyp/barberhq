import { test, expect, type Page } from './test.ts';
import { AxeBuilder } from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import {
  createDeliveryHarness,
  seedDispatchedDelivery,
  openDeliveryIssue,
  readDeliverySnapshot,
  dispatchDeliveryRequest,
  receiveDeliveryRequest,
  executeDelivery,
  type DeliveryHarness,
  type DeliverySnapshot,
} from '../support/delivery.ts';
import { seedDeliveryPdf } from './delivery.fixture.ts';
let h: DeliveryHarness,
  root: Awaited<ReturnType<typeof openDeliveryIssue>>,
  after: DeliverySnapshot;
const evidence = '.superpowers/sdd/2026-10-25-delivery-receipts-and-issues/screenshots';
async function login(page: Page, role: 'hq' | 'legnicka') {
  await page.goto('/login');
  const c = h.loginCredentials(role);
  await page.getByLabel('Email address').fill(c.email);
  await page.getByLabel('Password', { exact: true }).fill(c.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page
    .getByRole('heading', { name: role === 'hq' ? 'Salon requests' : 'Legnicka', exact: true })
    .waitFor();
}
async function open(page: Page, role: 'hq' | 'legnicka' = 'hq') {
  await page.goto(
    role === 'hq'
      ? `/hq/delivery-issues/${root.issueId}`
      : `/salons/${h.legnickaId}/delivery-issues/${root.issueId}`,
  );
  await page.getByRole('heading', { name: 'Delivery issue', exact: true }).waitFor();
  await page.getByRole('region', { name: 'Outstanding units', exact: true }).waitFor();
}
async function confirm(page: Page, label: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
}
test.describe('Feature: HQ resolves a delivery issue through linked replacements', () => {
  test.beforeEach(async () => {
    test.setTimeout(60000);
    h = undefined!;
    h = await createDeliveryHarness('issue-browser');
    root = await openDeliveryIssue(h);
    await mkdir(evidence, { recursive: true });
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });
  test.describe('Given an open issue for two damaged units', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'hq');
      await page.getByRole('radio', { name: /Delivery issues/ }).click();
      await page.getByRole('link', { name: 'Open delivery issue · Legnicka', exact: true }).click();
      await page.getByRole('region', { name: 'Outstanding units', exact: true }).waitFor();
    });
    test.describe('When HQ reviews it and creates one replacement despite a double click', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Start review', exact: true }).click();
        await page.getByText('Under review', { exact: true }).waitFor();
        await page
          .getByLabel('HQ note', { exact: true })
          .fill('Replacement arranged with warehouse');
        await page.getByRole('button', { name: 'Add note', exact: true }).click();
        await page.getByText('Replacement arranged with warehouse', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Create replacement', exact: true }).dblclick();
        await page.getByRole('link', { name: 'Open replacement request', exact: true }).waitFor();
        after = await readDeliverySnapshot(h);
        await page.screenshot({ path: `${evidence}/issue-replacement.png`, fullPage: true });
      });
      test('Then one pending child covers two units without changing original receipt or stock', async ({
        page,
      }) => {
        expect(after.requests).toHaveLength(2);
        expect(after.requests.find((r) => r.id !== root.rootRequestId)).toMatchObject({
          state: 'PENDING_APPROVAL',
          items: [expect.objectContaining({ quantity: 2 })],
        });
        expect(after.salonInventory.onHand).toBe(10);
        expect(after.receiptItems[0].goodQuantity).toBe(8);
        await expect(page.getByRole('button', { name: 'Resolve issue', exact: true })).toHaveCount(
          0,
        );
      });
    });
  });
  test.describe('Given a pending replacement child', () => {
    let childId: string;
    test.beforeEach(async ({ page }) => {
      const created = await executeDelivery(h, 'hq', {
        type: 'CREATE_REPLACEMENT',
        input: { issueId: root.issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
      });
      childId = created.replacementRequestId!;
      await login(page, 'hq');
      await open(page);
    });
    test.describe('When HQ approves and dispatches it through the normal request view', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('link', { name: 'Open replacement request', exact: true }).click();
        await confirm(page, 'Approve request');
        await confirm(page, 'Confirm dispatch');
        await page
          .getByRole('link', { name: 'Replacement for delivery issue', exact: true })
          .click();
        await page.getByText('Dispatched', { exact: true }).waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then the issue displays the actual child state and remains open', async () => {
        expect(after.requests.find((r) => r.id === childId)?.state).toBe('DISPATCHED');
        expect(after.issues[0].status).toBe('REPLACEMENT_IN_PROGRESS');
        expect(after.hqInventory.onHand).toBe(6);
      });
    });
  });
  test.describe('Given a replacement received as one good and one damaged unit', () => {
    test.beforeEach(async ({ page }) => {
      const child = await executeDelivery(h, 'hq', {
        type: 'CREATE_REPLACEMENT',
        input: { issueId: root.issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
      });
      await dispatchDeliveryRequest(h, child.replacementRequestId!);
      await receiveDeliveryRequest(h, child.replacementRequestId!, 1, 1);
      await login(page, 'hq');
      await open(page);
    });
    test.describe('When HQ creates the next replacement', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Create replacement', exact: true }).click();
        await page
          .getByRole('link', { name: 'Open replacement request', exact: true })
          .nth(1)
          .waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then remaining entitlement is one, with the original eight good units retained', async ({
        page,
      }) => {
        expect(after.issues).toHaveLength(1);
        expect(after.issues[0].items[0]).toMatchObject({
          initialAffectedQuantity: 2,
          replacementAcceptedQuantity: 1,
        });
        expect(
          after.requests.filter((r) => r.state === 'PENDING_APPROVAL')[0].items[0].quantity,
        ).toBe(1);
        expect(
          after.receiptItems.find(
            (r) =>
              r.receiptId === after.receipts.find((r) => r.requestId === root.rootRequestId)!.id,
          )?.goodQuantity,
        ).toBe(8);
        await expect(page.getByRole('region', { name: 'Outstanding units' })).toContainText(
          '1 unit remaining',
        );
      });
    });
  });
  test.describe('Given an ordinary active order for the affected product', () => {
    test.beforeEach(async ({ page }) => {
      await new StockRepository(h.operator).execute(h.users.legnicka, {
        type: 'SUBMIT',
        input: {
          salonId: h.legnickaId,
          items: [{ productId: root.productId, quantity: 1 }],
          idempotencyKey: randomUUID(),
        },
      });
      await login(page, 'hq');
      await open(page);
    });
    test.describe('When HQ attempts a replacement', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Create replacement', exact: true }).click();
        await page
          .getByRole('status')
          .filter({ hasText: /active/i })
          .waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then the normal active order conflict keeps the issue open without a hidden movement', async () => {
        expect(after.requests).toHaveLength(2);
        expect(after.requests.filter((r) => r.replacementIssueId === root.issueId)).toEqual([]);
        expect(after.issues[0]).toMatchObject({ status: 'OPEN', activeReplacementRequestId: null });
        expect(after.movements).toHaveLength(2);
      });
    });
  });
  test.describe('Given staff viewing the issue in their salon', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'legnicka');
      await open(page, 'legnicka');
    });
    test.describe('When the issue is opened', () => {
      test('Then facts are visible and HQ commands are absent', async ({ page }) => {
        await expect(page.getByRole('region', { name: 'Original inspection' })).toContainText(
          '8 good',
        );
        await expect(
          page.getByRole('button', { name: 'Create replacement', exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Start review', exact: true })).toHaveCount(
          0,
        );
        await expect(page.getByLabel('HQ note')).toHaveCount(0);
      });
    });
  });

  test.describe('Given an issue with a selected original procedure and an unsent HQ note', () => {
    test.beforeEach(async ({ page }) => {
      const source = await seedDeliveryPdf(h),
        delivery = await seedDispatchedDelivery(h, [2]);
      const receipt = await executeDelivery(h, 'legnicka', {
        type: 'RECORD_RECEIPT',
        input: {
          requestId: delivery.requestId,
          expectedRevision: 3,
          idempotencyKey: randomUUID(),
          items: [
            {
              productId: delivery.items[0].productId,
              goodQuantity: 1,
              damagedQuantity: 1,
              missingQuantity: 0,
            },
          ],
          report: { description: 'One cracked jar', batchIdentifier: null },
          procedureReferences: [{ kind: 'DAMAGED', versionId: source.versionId }],
        },
      });
      root = {
        issueId: receipt.issueId!,
        rootRequestId: delivery.requestId,
        productId: delivery.items[0].productId,
      };
      await page.route('**/getSourcePdf?*', (route) =>
        route.fulfill({ status: 200, contentType: 'application/pdf', body: source.bytes }),
      );
      await login(page, 'hq');
      await open(page);
      await page
        .getByLabel('HQ note', { exact: true })
        .fill('Call the warehouse after checking the procedure');
    });
    test.describe('When HQ opens the original PDF and returns to the same issue', () => {
      test.beforeEach(async ({ page }) => {
        await page
          .getByRole('region', { name: 'Original inspection', exact: true })
          .getByRole('button', { name: 'Open damaged product procedure', exact: true })
          .click();
        await page.getByTestId('pdf-page-canvas').waitFor();
        await page.getByRole('button', { name: 'Back to Delivery issue', exact: true }).click();
        await page.getByLabel('HQ note', { exact: true }).waitFor();
      });
      test('Then the note remains unsent and the issue is the original authorized issue', async ({
        page,
      }) => {
        await expect(page).toHaveURL(new RegExp(`/hq/delivery-issues/${root.issueId}$`));
        await expect(page.getByLabel('HQ note', { exact: true })).toHaveValue(
          'Call the warehouse after checking the procedure',
        );
        const snapshot = await readDeliverySnapshot(h);
        expect(snapshot.events.filter((e) => e.type === 'NOTE_ADDED')).toEqual([]);
      });
    });
  });
  test.describe('Given a replacement creation whose committed response is lost', () => {
    let posted: unknown[];
    test.beforeEach(async ({ page }) => {
      posted = [];
      await login(page, 'hq');
      await open(page);
      let lost = false;
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/commands')) {
          const { op, input } = r.postDataJSON().data;
          if (op === 'createDeliveryReplacement') posted.push({ data: input });
        }
      });
      await page.route('**/commands', async (route) => {
        if (
          route.request().method() !== 'POST' ||
          route.request().postDataJSON().data.op !== 'createDeliveryReplacement' ||
          lost
        )
          return route.fallback();
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
    test.describe('When HQ reloads and reconciles the saved action', () => {
      test.beforeEach(async ({ page }) => {
        await page.getByRole('button', { name: 'Create replacement', exact: true }).click();
        await page.getByRole('button', { name: 'Retry saved action', exact: true }).waitFor();
        await page.reload();
        await page.getByRole('button', { name: 'Retry saved action', exact: true }).click();
        await page.getByText('The earlier action was recorded.', { exact: true }).waitFor();
        after = await readDeliverySnapshot(h);
      });
      test('Then the same command creates exactly one linked child', async () => {
        expect(posted).toHaveLength(2);
        expect(posted[1]).toEqual(posted[0]);
        expect(after.requests.filter((r) => r.replacementIssueId === root.issueId)).toHaveLength(1);
        expect(after.commands.filter((c) => c.type === 'CREATE_REPLACEMENT')).toHaveLength(1);
      });
    });
  });
  test.describe('Given a rejected replacement child', () => {
    test.beforeEach(async ({ page }) => {
      const child = await executeDelivery(h, 'hq', {
        type: 'CREATE_REPLACEMENT',
        input: { issueId: root.issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
      });
      await new StockRepository(h.operator).execute(h.users.hq, {
        type: 'REJECT',
        input: {
          requestId: child.replacementRequestId!,
          expectedRevision: 1,
          idempotencyKey: randomUUID(),
          reason: 'Re-plan warehouse delivery',
        },
      });
      await login(page, 'hq');
      await open(page);
    });
    test.describe('When HQ reviews the issue again', () => {
      test('Then the rejected child remains visible and the same entitlement can be retried', async ({
        page,
      }) => {
        await expect(page.getByText('Under review', { exact: true })).toBeVisible();
        await expect(page.getByText('Rejected', { exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Outstanding units' })).toContainText(
          '2 units remaining',
        );
        await expect(
          page.getByRole('button', { name: 'Create replacement', exact: true }),
        ).toBeEnabled();
      });
    });
  });
  test.describe('Given a fully accepted replacement', () => {
    test.beforeEach(async ({ page }) => {
      const child = await executeDelivery(h, 'hq', {
        type: 'CREATE_REPLACEMENT',
        input: { issueId: root.issueId, expectedRevision: 1, idempotencyKey: randomUUID() },
      });
      await dispatchDeliveryRequest(h, child.replacementRequestId!);
      await receiveDeliveryRequest(h, child.replacementRequestId!);
      await login(page, 'hq');
      await open(page);
      after = await readDeliverySnapshot(h);
    });
    test.describe('When the resolved history is opened', () => {
      test('Then the original problem remains and balances include only accepted good units', async ({
        page,
      }) => {
        await expect(page.getByText('Resolved', { exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Original inspection' })).toContainText(
          '8 good',
        );
        await expect(page.getByRole('region', { name: 'Outstanding units' })).toContainText(
          '0 units remaining',
        );
        await expect(
          page.getByRole('button', { name: 'Create replacement', exact: true }),
        ).toHaveCount(0);
        expect(after.salonInventory.onHand).toBe(12);
        expect(after.hqInventory.onHand).toBe(6);
        expect(
          after.movements
            .filter((r) => r.type === 'DISPATCH')
            .reduce((sum, r) => sum + r.quantity, 0),
        ).toBe(12);
      });
    });
  });

  test.describe('Given staff with access to Legnicka only', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, 'legnicka');
    });
    test.describe('When they open the HQ issue route directly', () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(`/hq/delivery-issues/${root.issueId}`);
      });
      test('Then the HQ review is inaccessible', async ({ page }) => {
        await expect(page).toHaveURL(/no-access/);
        await expect(
          page.getByRole('button', { name: 'Create replacement', exact: true }),
        ).toHaveCount(0);
      });
    });
  });
  test.describe('Given zero good units in a separate inspected delivery', () => {
    test.beforeEach(async ({ page }) => {
      const delivery = await seedDispatchedDelivery(h, [2]);
      const receipt = await executeDelivery(h, 'legnicka', {
        type: 'RECORD_RECEIPT',
        input: {
          requestId: delivery.requestId,
          expectedRevision: 3,
          idempotencyKey: randomUUID(),
          items: [
            { productId: root.productId, goodQuantity: 0, damagedQuantity: 0, missingQuantity: 2 },
          ],
          report: { description: 'Empty parcel', batchIdentifier: null },
          procedureReferences: [],
        },
      });
      root = { ...root, issueId: receipt.issueId!, rootRequestId: delivery.requestId };
      await login(page, 'legnicka');
      await open(page, 'legnicka');
    });
    test.describe('When the issue facts are opened', () => {
      test('Then zero good units and two missing units are explicit', async ({ page }) => {
        await expect(page.getByRole('region', { name: 'Original inspection' })).toContainText(
          '0 good · 0 damaged · 2 missing',
        );
        await expect(page.getByText(/all received/i)).toHaveCount(0);
      });
    });
  });
  for (const width of [320, 360, 1280]) {
    test.describe(`Given HQ on a ${width}px viewport`, () => {
      let violations: unknown[], overflow: number;
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await login(page, 'hq');
        await open(page);
      });
      test.describe('When the note is entered using the keyboard', () => {
        test.beforeEach(async ({ page }) => {
          await page.getByLabel('HQ note', { exact: true }).focus();
          await page.keyboard.type('Warehouse follow-up');
          violations = (await new AxeBuilder({ page }).analyze()).violations;
          overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
          await page.screenshot({ path: `${evidence}/issue-${width}.png`, fullPage: true });
        });
        test('Then controls and quantities are accessible without overflow', async ({ page }) => {
          await expect(page.getByRole('button', { name: 'Add note', exact: true })).toBeEnabled();
          expect(violations).toEqual([]);
          expect(overflow).toBeLessThanOrEqual(0);
        });
      });
    });
  }
});
