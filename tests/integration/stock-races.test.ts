import { DeliveryRepository } from '../../functions/src/delivery/repository.ts';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { StockRepository } from '../../functions/src/stock/repository.ts';
import type { StockAction, SubmitInput } from '../../shared/contracts/stock.ts';
let h: Awaited<ReturnType<typeof createCloudHarness>>;
let repo: StockRepository;
beforeEach(async () => {
  h = await createCloudHarness('races');
  repo = new StockRepository(h.operator);
});
afterEach(async () => {
  if (h) await h.dispose();
});
const submitInput = (): SubmitInput => ({
  salonId: h.legnickaId,
  items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
  idempotencyKey: randomUUID(),
});
const submit = () => repo.execute(h.users.legnicka, { type: 'SUBMIT', input: submitInput() });
const approve = (id: string, version = 1) =>
  repo.execute(h.users.hq, {
    type: 'APPROVE',
    input: {
      requestId: id,
      expectedRevision: 1,
      inventoryVersions: [
        {
          productId: `${h.businessId}:NBS-MATOWA-100`,
          expectedHqInventoryVersion: version,
        },
      ],
      idempotencyKey: randomUUID(),
    },
  });
async function snapshot() {
  return (
    await h.operator.executeGraphql(
      `query($id:String!){
    inventories(where:{location:{businessId:{eq:$id}}},orderBy:[{locationId:ASC},{productId:ASC}]){locationId productId onHand reserved version}
    replenishmentRequests(where:{businessId:{eq:$id}},orderBy:{id:ASC}){id state revision}
    transfers(where:{businessId:{eq:$id}}){requestId}
    transferItems(where:{transfer:{businessId:{eq:$id}}}){requestItemId dispatchedQuantity receivedQuantity}
    stockMovements(where:{businessId:{eq:$id}}){transferItemRequestItemId type quantity}
    actionReceipts(where:{businessId:{eq:$id}}){id}
    activeRequests(where:{businessId:{eq:$id}}){requestId}
  }`,
      { variables: { id: h.businessId } },
    )
  ).data;
}
it('competing_approvals_do_not_oversell', async () => {
  await h.setInventory('hq', 'NBS-MATOWA-100', 3);
  const a = await submit();
  const b = await repo.execute(h.users.lodzka, {
    type: 'SUBMIT',
    input: { ...submitInput(), salonId: `${h.businessId}:lodzka` },
  });
  const outcomes = await Promise.allSettled([approve(a.requestId), approve(b.requestId)]);
  expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const inventory = (
    await h.operator.executeGraphql<
      { inventories: { onHand: number; reserved: number }[] },
      Record<string, string>
    >(
      'query($id:String!){inventories(where:{locationId:{eq:$id},product:{demoId:{eq:"NBS-MATOWA-100"}}}){onHand reserved}}',
      { variables: { id: `${h.businessId}:hq` } },
    )
  ).data.inventories[0];
  expect(inventory).toEqual({ onHand: 3, reserved: 2 });
});
it('same_key_races_create_one_request', async () => {
  const action: StockAction = { type: 'SUBMIT', input: submitInput() };
  const results = await Promise.all([
    repo.execute(h.users.legnicka, action),
    repo.execute(h.users.legnicka, action),
  ]);
  expect(new Set(results.map((r) => r.requestId)).size).toBe(1);
  expect(results.filter((r) => r.replayed)).toHaveLength(1);
});
it('lost_response_replays_and_new_key_semantically_replays', async () => {
  const created = await submit();
  await approve(created.requestId);
  const action: StockAction = {
    type: 'DISPATCH',
    input: {
      requestId: created.requestId,
      expectedRevision: 2,
      idempotencyKey: randomUUID(),
    },
  };
  const first = await repo.execute(h.users.hq, action);
  const before = await snapshot();
  expect(await repo.execute(h.users.hq, action)).toEqual({
    ...first,
    replayed: true,
  });
  expect(
    await repo.execute(h.users.hq, {
      ...action,
      input: { ...action.input, idempotencyKey: randomUUID() },
    }),
  ).toEqual({ ...first, replayed: true });
  expect(await snapshot()).toEqual(before);
});
it('revoked_actor_cannot_replay', async () => {
  const action: StockAction = { type: 'SUBMIT', input: submitInput() };
  await repo.execute(h.users.legnicka, action);
  await h.operator.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
    variables: { uid: h.users.legnicka },
  });
  await expect(repo.execute(h.users.legnicka, action)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});
it('rejects_conflicting_keys_wrong_scope_stale_versions_and_partial_receipt', async () => {
  const action: StockAction = { type: 'SUBMIT', input: submitInput() };
  const created = await repo.execute(h.users.legnicka, action);
  await expect(
    repo.execute(h.users.legnicka, {
      ...action,
      input: {
        ...action.input,
        items: [{ ...action.input.items[0], quantity: 3 }],
      },
    }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  await expect(repo.execute(h.users.lodzka, action)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await expect(
    repo.execute(h.users.foreign, {
      type: 'APPROVE',
      input: {
        requestId: created.requestId,
        expectedRevision: 1,
        inventoryVersions: [
          {
            productId: `${h.businessId}:NBS-MATOWA-100`,
            expectedHqInventoryVersion: 1,
          },
        ],
        idempotencyKey: randomUUID(),
      },
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(approve(created.requestId, 9)).rejects.toMatchObject({
    code: 'STALE_STATE',
  });
  await approve(created.requestId);
  await repo.execute(h.users.hq, {
    type: 'DISPATCH',
    input: {
      requestId: created.requestId,
      expectedRevision: 2,
      idempotencyKey: randomUUID(),
    },
  });
  const before = await snapshot();
  await expect(
    new DeliveryRepository(h.operator).execute(h.users.legnicka, {
      type: 'RECORD_RECEIPT',
      input: {
        requestId: created.requestId,
        expectedRevision: 3,
        items: [
          {
            productId: `${h.businessId}:NBS-MATOWA-100`,
            goodQuantity: 1,
            damagedQuantity: 0,
            missingQuantity: 0,
          },
        ],
        procedureReferences: [],

        idempotencyKey: randomUUID(),
      },
    }),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(await snapshot()).toEqual(before);
});
it('failure_rolls_back_all_writes', async () => {
  const created = await submit();
  await approve(created.requestId);
  // Corrupt only this isolated fixture: force the later transfer guard to fail,
  // after the transaction has attempted request and inventory writes.
  await h.operator.executeGraphql(
    'mutation($id:String!){transferItem_updateMany(where:{transferRequestId:{eq:$id}},data:{dispatchedQuantity:1})}',
    { variables: { id: created.requestId } },
  );
  const before = await snapshot();
  await expect(
    repo.execute(h.users.hq, {
      type: 'DISPATCH',
      input: {
        requestId: created.requestId,
        expectedRevision: 2,
        idempotencyKey: randomUUID(),
      },
    }),
  ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  expect(await snapshot()).toEqual(before);
});
it('semantic_replay_binds_the_new_key_to_its_original_payload', async () => {
  const request = await submit();
  const first = await approve(request.requestId);
  const key = randomUUID();
  const replay: StockAction = {
    type: 'APPROVE',
    input: {
      requestId: request.requestId,
      expectedRevision: 1,
      inventoryVersions: [
        {
          productId: `${h.businessId}:NBS-MATOWA-100`,
          expectedHqInventoryVersion: 1,
        },
      ],
      idempotencyKey: key,
    },
  };
  expect((await repo.execute(h.users.hq, replay)).actionReceiptId).toBe(first.actionReceiptId);
  await expect(
    repo.execute(h.users.hq, {
      ...replay,
      input: { ...replay.input, expectedRevision: 999 },
    }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
});
it('browser_reads_are_scoped_and_server_mutations_are_not_public', async () => {
  const created = await submit();
  const browser = await import('@barberhq/browser');
  expect(
    (
      await browser.getRequestDetail(h.browserClient('legnicka'), {
        requestId: created.requestId,
      })
    ).data.membership?.business.requests[0].id,
  ).toBe(created.requestId);
  await expect(
    browser.getRequestDetail(h.browserClient('lodzka'), {
      requestId: created.requestId,
    }),
  ).rejects.toThrow();
  await expect(
    browser.getRequestDetail(h.browserClient('foreign'), {
      requestId: created.requestId,
    }),
  ).rejects.toThrow();
  await expect(
    browser.listHqQueue(h.browserClient('legnicka'), { limit: 50, offset: 0 }),
  ).rejects.toThrow();
  await expect(h.ordinaryOperatorWrite()).rejects.toThrow();
});
