import { expect, it } from 'vitest';
import {
  availableRequestActions,
  canConfirm,
  buildAction,
  type Confirmation,
} from './action-input';
import type { RequestDetail, RequestDetailItem } from '../../../../../../shared/contracts/stock/index';
const item = (id: string, quantity: number): RequestDetailItem => ({
  productId: id,
  productName: id,
  quantity,
  dispatchedQuantity: quantity,
  receivedQuantity: 0,
  stock: {
    productId: id,
    demoId: id,
    productName: id,
    netContent: { value: 100, unit: 'ml' },
    salonId: 'salon',
    salonOnHand: 2,
    salonInventoryVersion: 1,
    hqOnHand: 16,
    hqReserved: 0,
    hqAvailable: 16,
    hqInventoryVersion: 2,
  },
});
const request: RequestDetail = {
  id: 'r',
  salonId: 'salon',
  salonName: 'Legnicka',
  state: 'DISPATCHED',
  revision: 3,
  createdAt: '2026-10-07T10:00:00Z',
  items: [item('a', 2), item('b', 3)],
  itemCount: 2,
  totalUnits: 5,
  timeline: [],
};
const confirmation: Confirmation = {
  reason: '',
  items: [
    { productId: 'a', receivedQuantity: 2 },
    { productId: 'b', receivedQuantity: 3 },
  ],
  allIntact: true,
};
it('blocks_damaged_missing_duplicate_and_partial_receipts', () => {
  expect(canConfirm('RECEIVE', request, confirmation)).toBe(true);
  for (const value of [
    { ...confirmation, allIntact: false },
    { ...confirmation, items: confirmation.items.slice(1) },
    { ...confirmation, items: [confirmation.items[0], confirmation.items[0]] },
    { ...confirmation, items: confirmation.items.map((i) => ({ ...i, receivedQuantity: 1 })) },
  ])
    expect(canConfirm('RECEIVE', request, value)).toBe(false);
});
it('approval_checks_every_product_and_rejection_requires_reason', () => {
  const pending = { ...request, state: 'PENDING_APPROVAL' as const };
  expect(canConfirm('APPROVE', pending, confirmation)).toBe(true);
  expect(
    canConfirm(
      'APPROVE',
      {
        ...pending,
        items: [
          pending.items[0],
          { ...pending.items[1], stock: { ...pending.items[1].stock, hqAvailable: 1 } },
        ],
      },
      confirmation,
    ),
  ).toBe(false);
  expect(canConfirm('REJECT', pending, { ...confirmation, reason: '  ' })).toBe(false);
  expect(buildAction('APPROVE', pending, confirmation, 'key')).toMatchObject({
    input: {
      inventoryVersions: [
        { productId: 'a', expectedHqInventoryVersion: 2 },
        { productId: 'b', expectedHqInventoryVersion: 2 },
      ],
    },
  });
});

it('separates_workspace_actions_without_changing_authenticated_role', () => {
  const hq = { userId: 'hq', businessId: 'b', role: 'HQ' as const, salonIds: ['salon'] };
  const salon = { ...hq, role: 'SALON' as const };
  const pending = { ...request, state: 'PENDING_APPROVAL' as const };
  expect(availableRequestActions(hq, pending, 'HQ')).toEqual(['APPROVE', 'REJECT']);
  expect(availableRequestActions(hq, pending, 'SALON')).toEqual([]);
  expect(availableRequestActions(salon, pending, 'HQ')).toEqual([]);
  expect(availableRequestActions(hq, { ...request, state: 'RESERVED' }, 'HQ')).toEqual([
    'DISPATCH',
  ]);
  expect(availableRequestActions(hq, request, 'HQ')).toEqual([]);
  expect(availableRequestActions(hq, request, 'SALON')).toEqual(['RECEIVE']);
  expect(availableRequestActions(salon, request, 'SALON')).toEqual(['RECEIVE']);
  expect(availableRequestActions({ ...hq, salonIds: [] }, request, 'SALON')).toEqual([]);
});
