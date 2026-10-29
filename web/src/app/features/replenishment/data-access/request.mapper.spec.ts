import { RequestState, DeliveryIssueStatus } from '../../../core/generated';
import { expect, it } from 'vitest';
import { toRequestSummary, toRequestDetail } from './request.mapper';
import type { InventoryRow } from '../../../../../../shared/contracts/business/index';
const record: Parameters<typeof toRequestDetail>[0] = {
  id: 'r',
  salonId: 's',
  salon: { name: 'Legnicka' },
  state: RequestState.DISPATCHED,
  revision: 3,
  createdAt: '2026-10-07T10:00:00Z',
  replacementIssueId: null,
  replacementIssue: undefined,
  replacementCreation: [],
  receipt: undefined,
  items: [
    {
      id: 'i1',
      productId: 'a',
      quantity: 2,
      product: { name: 'Matowa' },
      transferItem: { dispatchedQuantity: 2, receivedQuantity: 0 },
    },
    {
      id: 'i2',
      productId: 'b',
      quantity: 3,
      product: { name: 'Cement' },
      transferItem: { dispatchedQuantity: 3, receivedQuantity: 0 },
    },
  ],
  timeline: [
    {
      id: 'old-action',
      revision: 2,
      state: RequestState.REJECTED,
      action: 'REJECT',
      createdAt: '2026-10-07T10:00:00Z',
      reason: 'Unavailable',
    },
  ],
};
const inventory: InventoryRow[] = record.items.map((i) => ({
  productId: i.productId,
  demoId: i.productId,
  productName: i.product.name,
  netContent: { value: 100, unit: 'ml' },
  salonId: 's',
  salonOnHand: 2,
  salonInventoryVersion: 1,
  hqOnHand: 16,
  hqReserved: 0,
  hqAvailable: 16,
  hqInventoryVersion: 2,
}));
it('maps_all_items_and_totals_without_losing_rejection_reason', () => {
  expect(toRequestSummary(record)).toMatchObject({ itemCount: 2, totalUnits: 5 });
  expect(toRequestDetail(record, inventory).items.map((i) => i.dispatchedQuantity)).toEqual([2, 3]);
  expect(toRequestDetail(record, inventory).timeline[0].reason).toBe('Unavailable');
});
const receipt = {
  id: 'receipt',
  requestId: 'r',
  recordedAt: '2026-10-25T10:00:00Z',
  actorUid: 'recipient',
  origin: 'RECORDED' as const,
  legacyActionReceiptId: null as string | null,
  description: 'Damage and shortage',
  batchIdentifier: null,
  rootIssueId: 'issue',
  items: [
    {
      productId: 'a',
      goodQuantity: 1,
      damagedQuantity: 1,
      missingQuantity: 0,
      product: { name: 'Matowa' },
    },
    {
      productId: 'b',
      goodQuantity: 0,
      damagedQuantity: 0,
      missingQuantity: 3,
      product: { name: 'Cement' },
    },
  ],
  procedureReferences: [],
  rootIssue: { id: 'issue', status: DeliveryIssueStatus.OPEN, revision: 1 },
};
it('maps_terminal_problem_quantities_per_product_and_adds_receipt_history', () => {
  const result = toRequestDetail(
    { ...record, state: RequestState.RECEIVED_WITH_ISSUE, revision: 4, receipt },
    inventory,
  );
  expect(result.items).toEqual([
    expect.objectContaining({
      delivery: { inTransit: 0, goodQuantity: 1, damagedQuantity: 1, missingQuantity: 0 },
    }),
    expect.objectContaining({
      delivery: { inTransit: 0, goodQuantity: 0, damagedQuantity: 0, missingQuantity: 3 },
    }),
  ]);
  expect(result).toMatchObject({
    delivery: { rootIssue: { id: 'issue', status: 'OPEN' }, replacementForIssueId: null },
  });
  expect(result.timeline.filter((event) => event.state === 'RECEIVED_WITH_ISSUE')).toHaveLength(1);
});
it('does_not_duplicate_legacy_receive_when_backfill_points_to_its_action_receipt', () => {
  const legacy = {
    ...receipt,
    origin: 'LEGACY' as const,
    legacyActionReceiptId: 'legacy',
    rootIssueId: null,
    rootIssue: undefined,
    items: receipt.items.map((item, i) => ({
      ...item,
      goodQuantity: [2, 3][i],
      damagedQuantity: 0,
      missingQuantity: 0,
    })),
  };
  const result = toRequestDetail(
    {
      ...record,
      state: RequestState.RECEIVED,
      revision: 4,
      receipt: legacy,
      timeline: [
        {
          id: 'legacy',
          revision: 4,
          state: RequestState.RECEIVED,
          action: 'RECEIVE',
          createdAt: '2026-10-07T11:00:00Z',
          reason: null,
        },
      ],
    },
    inventory,
  );
  expect(result.timeline).toHaveLength(1);
  expect(result.timeline[0].at).toBe('2026-10-07T11:00:00Z');
});
it('shows_replacement_creation_from_the_actual_issue_event', () => {
  const result = toRequestDetail(
    {
      ...record,
      state: RequestState.PENDING_APPROVAL,
      revision: 1,
      timeline: [],
      replacementIssueId: 'issue',
      replacementIssue: {
        id: 'issue',
        status: DeliveryIssueStatus.REPLACEMENT_IN_PROGRESS,
        revision: 2,
      },
      replacementCreation: [{ id: 'creation', recordedAt: '2026-10-25T10:00:00Z' }],
    },
    inventory,
  );
  expect(result.timeline).toEqual([
    { state: 'PENDING_APPROVAL', at: '2026-10-25T10:00:00Z', actorLabel: 'HQ' },
  ]);
});
it('does_not_infer_salon_actor_for_submissions_that_can_come_from_hq', () => {
  const submitted = { ...record, timeline: [{ ...record.timeline[0], action: 'SUBMIT' as const }] };
  expect(toRequestDetail(submitted, inventory).timeline[0].actorLabel).toBe('Requester');
});
it('refuses_details_when_any_product_inventory_is_missing_or_from_another_salon', () => {
  expect(() => toRequestDetail(record, inventory.slice(1))).toThrow();
  expect(() =>
    toRequestDetail(
      record,
      inventory.map((i) => ({ ...i, salonId: 'foreign' })),
    ),
  ).toThrow();
});
