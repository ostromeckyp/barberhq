import { seedDeliveryPdf } from '../support/delivery-knowledge.ts';
import { beforeEach, afterEach, it, expect } from 'vitest';
import {
  createDeliveryHarness,
  seedLegacyReceivedDelivery,
  seedDispatchedDelivery,
  readDeliverySnapshot,
  type DeliveryHarness,
} from '../support/delivery.ts';
import {
  planDeliveryBackfill,
  readDeliveryBackfillSnapshot,
  applyDeliveryBackfill,
  type DeliveryTarget,
} from '../../scripts/migrations/delivery-receipts.ts';
let h: DeliveryHarness, target: DeliveryTarget;
beforeEach(async () => {
  h = undefined!;
  h = await createDeliveryHarness('delivery-backfill');
  target = {
    projectId: 'demo-barberhq',
    serviceId: 'barberhq',
    location: 'europe-west1',
    businessId: h.businessId,
  };
});
afterEach(async () => {
  if (h) await h.dispose();
});
it('legacy_backfill_preserves_all_original_balances_history_and_sources_and_is_repeatable', async () => {
  const pdf = await seedDeliveryPdf(h);
  const legacy = await seedLegacyReceivedDelivery(h),
    before = await readDeliveryBackfillSnapshot(h.operator, target),
    plan = planDeliveryBackfill(before);
  expect(plan.receipts).toHaveLength(1);
  expect(before.preservation.knowledgeVersions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        pdfSha256: (await import('node:crypto'))
          .createHash('sha256')
          .update(pdf.bytes)
          .digest('hex'),
      }),
    ]),
  );
  expect(
    await applyDeliveryBackfill(h.operator, plan, {
      confirmBusinessId: h.businessId,
      quiescent: true,
      snapshotHash: plan.snapshotHash,
    }),
  ).toMatchObject({ inserted: 1 });
  const after = await readDeliveryBackfillSnapshot(h.operator, target);
  expect(after.receipts[0]).toMatchObject({
    origin: 'LEGACY',
    actorUid: h.users.legnicka,
    recordedAt: before.actions.find((a) => a.id === legacy.receiptId)!.createdAt,
    legacyActionReceiptId: legacy.receiptId,
    items: [
      {
        productId: `${h.businessId}:NBS-MATOWA-100`,
        goodQuantity: 10,
        damagedQuantity: 0,
        missingQuantity: 0,
      },
    ],
  });
  expect({ ...after, receipts: [] }).toEqual(before);
  expect(planDeliveryBackfill(after).receipts).toEqual([]);
  expect(
    await applyDeliveryBackfill(h.operator, plan, {
      confirmBusinessId: h.businessId,
      quiescent: true,
      snapshotHash: plan.snapshotHash,
    }),
  ).toMatchObject({ inserted: 0 });
});
it('dispatched_is_not_inferred_as_received_and_target_or_snapshot_conflicts_write_nothing', async () => {
  await seedDispatchedDelivery(h);
  const before = await readDeliveryBackfillSnapshot(h.operator, target),
    plan = planDeliveryBackfill(before);
  expect(plan.receipts).toEqual([]);
  await expect(
    applyDeliveryBackfill(
      h.operator,
      { ...plan, target: { ...target, projectId: 'notbad-6be95' } },
      { confirmBusinessId: h.businessId, quiescent: true, snapshotHash: plan.snapshotHash },
    ),
  ).rejects.toThrow('TARGET_CONFLICT');
  await expect(
    applyDeliveryBackfill(h.operator, plan, {
      confirmBusinessId: h.businessId,
      quiescent: false,
      snapshotHash: plan.snapshotHash,
    }),
  ).rejects.toThrow('APPROVAL');
  await h.setInventory('hq', 'NBS-MATOWA-100', 7);
  await expect(
    applyDeliveryBackfill(h.operator, plan, {
      confirmBusinessId: h.businessId,
      quiescent: true,
      snapshotHash: plan.snapshotHash,
    }),
  ).rejects.toThrow();
  expect((await readDeliverySnapshot(h)).receipts).toEqual([]);
});
it('resumes_the_original_plan_after_one_real_receipt_transaction_committed', async () => {
  await seedLegacyReceivedDelivery(h, 2);
  await seedLegacyReceivedDelivery(h, 2);
  const plan = planDeliveryBackfill(await readDeliveryBackfillSnapshot(h.operator, target));
  let inserted = 0;
  const flaky = new Proxy(h.operator, {
    get(dc, key) {
      if (key === 'executeGraphql')
        return async (...args: Parameters<typeof dc.executeGraphql>) => {
          const result = await dc.executeGraphql(...args);
          if (String(args[0]).includes('deliveryReceipt_insert') && ++inserted === 1)
            throw new Error('Lost connection after first receipt');
          return result;
        };
      const value = Reflect.get(dc, key, dc);
      return typeof value === 'function' ? value.bind(dc) : value;
    },
  });
  await expect(
    applyDeliveryBackfill(flaky, plan, {
      confirmBusinessId: h.businessId,
      quiescent: true,
      snapshotHash: plan.snapshotHash,
    }),
  ).rejects.toThrow('Lost connection');
  expect((await readDeliverySnapshot(h)).receipts).toHaveLength(1);
  expect(
    await applyDeliveryBackfill(h.operator, plan, {
      confirmBusinessId: h.businessId,
      quiescent: true,
      snapshotHash: plan.snapshotHash,
    }),
  ).toMatchObject({ inserted: 1 });
  expect((await readDeliverySnapshot(h)).receipts).toHaveLength(2);
});

it('changed_historical_timestamp_before_native_insert_aborts_without_a_receipt', async () => {
  const legacy = await seedLegacyReceivedDelivery(h),
    plan = planDeliveryBackfill(await readDeliveryBackfillSnapshot(h.operator, target));
  let changed = false;
  const transport = new Proxy(h.operator, {
    get(dc, key) {
      if (key === 'executeGraphql')
        return async (...args: Parameters<typeof dc.executeGraphql>) => {
          if (!changed && String(args[0]).includes('deliveryReceipt_insert')) {
            changed = true;
            await dc.executeGraphql(
              'mutation($id:String!){actionReceipt_update(id:$id,data:{createdAt:"2026-10-21T10:00:00Z"})}',
              { variables: { id: legacy.receiptId } },
            );
          }
          return dc.executeGraphql(...args);
        };
      const value = Reflect.get(dc, key, dc);
      return typeof value === 'function' ? value.bind(dc) : value;
    },
  });
  await expect(
    applyDeliveryBackfill(transport, plan, {
      confirmBusinessId: h.businessId,
      quiescent: true,
      snapshotHash: plan.snapshotHash,
    }),
  ).rejects.toThrow();
  expect((await readDeliverySnapshot(h)).receipts).toEqual([]);
});

it('stable_pagination_includes_knowledge_beyond_the_first_hundred_rows', async () => {
  await seedLegacyReceivedDelivery(h);
  for (let i = 0; i < 101; i++)
    await h.operator.executeGraphql(
      'mutation($id:String!,$businessId:String!,$code:String!){knowledgeDocument_insert(data:{id:$id,businessId:$businessId,documentCode:$code})}',
      {
        variables: {
          id: `${h.businessId}:page-${String(i).padStart(3, '0')}`,
          businessId: h.businessId,
          code: `PAGE-${i}`,
        },
      },
    );
  const before = await readDeliveryBackfillSnapshot(h.operator, target);
  expect(before.preservation.knowledgeDocuments).toHaveLength(101);
  const plan = planDeliveryBackfill(before);
  await applyDeliveryBackfill(h.operator, plan, {
    confirmBusinessId: h.businessId,
    quiescent: true,
    snapshotHash: plan.snapshotHash,
  });
  const after = await readDeliveryBackfillSnapshot(h.operator, target);
  expect(after.preservation).toEqual(before.preservation);
});
