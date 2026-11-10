import { test, expect, type Page } from './test.ts';
import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase/auth';
import {
  createDeliveryHarness,
  seedLegacyReceivedDelivery,
  seedDispatchedDelivery,
  readDeliverySnapshot,
  type DeliveryHarness,
  type DeliverySnapshot,
} from '../support/delivery.ts';
import {
  readDeliveryBackfillSnapshot,
  planDeliveryBackfill,
  applyDeliveryBackfill,
} from '../../scripts/migrations/delivery-receipts.ts';
import type { ReceiveInput } from '../../shared/contracts/stock/index.ts';
let h: DeliveryHarness,
  input: ReceiveInput,
  token: string,
  before: DeliverySnapshot,
  after: DeliverySnapshot,
  response: { result?: { replayed: boolean }; error?: { details?: { code: string } } },
  saved: unknown;
async function call(page: Page) {
  return page.evaluate(
    async ({ input, token }) => {
      const recovery = window as unknown as { legacyReceive?: ReceiveInput };
      recovery.legacyReceive ??= Object.freeze(input);
      const result = await fetch('http://127.0.0.1:5001/demo-barberhq/europe-west1/commands', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: { op: 'receiveTransfer', input: recovery.legacyReceive } }),
      });
      return await result.json();
    },
    { input, token },
  );
}
test.describe('Feature: reconcile the legacy RECEIVE wire contract after upgrade', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    h = undefined!;
    h = await createDeliveryHarness('legacy-wire-browser');
    token = await getAuth(h.browserClient('legnicka').app).currentUser!.getIdToken();
    await page.goto('/login');
  });
  test.afterEach(async () => {
    if (h) await h.dispose();
  });
  test.describe('Given a previously committed legacy receive with an additive backfill', () => {
    test.beforeEach(async () => {
      const legacy = await seedLegacyReceivedDelivery(h);
      input = legacy.action.input;
      const target = {
          projectId: 'demo-barberhq',
          serviceId: 'barberhq',
          location: 'europe-west1',
          businessId: h.businessId,
        },
        plan = planDeliveryBackfill(await readDeliveryBackfillSnapshot(h.operator, target));
      await applyDeliveryBackfill(h.operator, plan, {
        confirmBusinessId: h.businessId,
        quiescent: true,
        snapshotHash: plan.snapshotHash,
      });
      before = await readDeliverySnapshot(h);
    });
    test.describe('When the old frozen key is reconciled through the callable', () => {
      test.beforeEach(async ({ page }) => {
        response = await call(page);
        after = await readDeliverySnapshot(h);
      });
      test('Then legacy_unknown_receive_reconciles_without_new_movement', async () => {
        expect(response.result?.replayed).toBe(true);
        expect(after).toEqual(before);
        expect(after.movements.filter((r) => r.type === 'RECEIPT')).toHaveLength(1);
        expect(after.receipts[0].origin).toBe('LEGACY');
      });
    });
  });
  test.describe('Given an uncommitted legacy receive frozen in an old client session', () => {
    test.beforeEach(async () => {
      const delivery = await seedDispatchedDelivery(h);
      input = {
        requestId: delivery.requestId,
        expectedRevision: 3,
        idempotencyKey: randomUUID(),
        items: delivery.items.map((i) => ({
          productId: i.productId,
          receivedQuantity: i.quantity,
        })),
        allIntact: true,
      };
      before = await readDeliverySnapshot(h);
    });
    test.describe('When the retired writer refuses it twice', () => {
      test.beforeEach(async ({ page }) => {
        await call(page);
        response = await call(page);
        saved = await page.evaluate(
          () => (window as unknown as { legacyReceive: ReceiveInput }).legacyReceive,
        );
        after = await readDeliverySnapshot(h);
      });
      test('Then legacy_uncommitted_receive_requires_update_without_losing_the_original_command', async () => {
        expect(response.error?.details?.code).toBe('CLIENT_UPDATE_REQUIRED');
        expect(saved).toEqual(input);
        expect(after).toEqual(before);
      });
    });
  });
});
