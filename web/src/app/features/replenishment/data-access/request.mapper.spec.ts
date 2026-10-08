import { RequestState } from '../../../core/generated';
import { expect, it } from 'vitest';
import { toRequestSummary, toRequestDetail } from './request.mapper';
import type { InventoryRow } from '../../../../../../shared/contracts/business';
const record: Parameters<typeof toRequestDetail>[0] = {
  id: 'r',
  salonId: 's',
  salon: { name: 'Legnicka' },
  state: RequestState.DISPATCHED,
  revision: 3,
  createdAt: '2026-10-07T10:00:00Z',
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
it('does_not_infer_salon_actor_for_submissions_that_can_come_from_hq', () => {
  const submitted = { ...record, timeline: [{ ...record.timeline[0], action: 'SUBMIT' }] };
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
