import { beforeEach, afterEach, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createCloudHarness } from '../support/cloud.ts';
import { listSalonRequests, getRequestDetail, RequestState } from '@barberhq/browser';
import { StockRepository } from '../../functions/src/stock/repository.ts';
let h: Awaited<ReturnType<typeof createCloudHarness>>;
beforeEach(async () => {
  h = await createCloudHarness('history');
});
afterEach(async () => {
  if (h) await h.dispose();
});
it('filters_history_before_pagination_with_stable_ties', async () => {
  const records = Array.from({ length: 80 }, (_, i) => ({
    id: `${h.businessId}:history-${String(i).padStart(3, '0')}`,
    businessId: h.businessId,
    salonId: h.legnickaId,
    state:
      i < 60
        ? 'RECEIVED'
        : i < 70
          ? 'REJECTED'
          : i < 74
            ? 'PENDING_APPROVAL'
            : i < 77
              ? 'RESERVED'
              : 'DISPATCHED',
    revision: 1,
    createdAt: '2026-10-07T10:00:00Z',
  }));
  await h.operator.executeGraphql(
    'mutation($rows:[ReplenishmentRequest_Data!]!){replenishmentRequest_insertMany(data:$rows)}',
    { variables: { rows: records } },
  );
  const query = async (states: RequestState[], offset = 0) =>
    (
      await listSalonRequests(h.browserClient('legnicka'), {
        salonId: h.legnickaId,
        states,
        limit: 50,
        offset,
      })
    ).data.membership!.business.requests;
  expect((await query(Object.values(RequestState))).map((r) => r.id)).toEqual(
    records.slice(0, 50).map((r) => r.id),
  );
  expect((await query(Object.values(RequestState), 50)).map((r) => r.id)).toEqual(
    records.slice(50).map((r) => r.id),
  );
  expect((await query([RequestState.REJECTED])).map((r) => r.id)).toEqual(
    records.slice(60, 70).map((r) => r.id),
  );
  expect(
    (
      await query([RequestState.PENDING_APPROVAL, RequestState.RESERVED, RequestState.DISPATCHED])
    ).map((r) => r.id),
  ).toEqual(records.slice(70).map((r) => r.id));
});
it('retains_rejected_items_reason_and_time_and_rejects_foreign_reads', async () => {
  const repo = new StockRepository(h.operator);
  const r = await repo.execute(h.users.legnicka, {
    type: 'SUBMIT',
    input: {
      salonId: h.legnickaId,
      items: [{ productId: `${h.businessId}:NBS-MATOWA-100`, quantity: 2 }],
      idempotencyKey: randomUUID(),
    },
  });
  await repo.execute(h.users.hq, {
    type: 'REJECT',
    input: {
      requestId: r.requestId,
      expectedRevision: 1,
      reason: 'Product unavailable',
      idempotencyKey: randomUUID(),
    },
  });
  const vars = {
    salonId: h.legnickaId,
    states: [RequestState.REJECTED],
    limit: 50,
    offset: 0,
  };
  const rows = (await listSalonRequests(h.browserClient('legnicka'), vars)).data.membership!
    .business.requests;
  expect(rows[0].items[0].quantity).toBe(2);
  const detail = (
    await getRequestDetail(h.browserClient('legnicka'), {
      requestId: r.requestId,
    })
  ).data.membership!.business.requests[0];
  expect(detail.timeline.at(-1)).toMatchObject({
    reason: 'Product unavailable',
    state: 'REJECTED',
    createdAt: expect.any(String),
  });
  await expect(listSalonRequests(h.browserClient('lodzka'), vars)).rejects.toThrow();
  const foreign = await listSalonRequests(h.browserClient('foreign'), vars);
  expect(foreign.data.membership!.business.requests).toEqual([]);
  await expect(
    getRequestDetail(h.browserClient('foreign'), { requestId: r.requestId }),
  ).rejects.toThrow();
});
