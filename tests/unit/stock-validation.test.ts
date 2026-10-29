import { describe, it, expect } from 'vitest';
import { parseAction } from '../../functions/src/stock/schemas.ts';
const key = '10000000-0000-4000-8000-000000000001';
const submit = {
  salonId: 'salon',
  items: [{ productId: 'product', quantity: 2 }],
  idempotencyKey: key,
};
describe('stock command inputs', () => {
  it.each([0, -1, 1.5, 100, '2', null])('rejects invalid quantity %s', (quantity) => {
    expect(() =>
      parseAction('SUBMIT', {
        ...submit,
        items: [{ productId: 'product', quantity }],
      }),
    ).toThrow();
  });
  it('rejects client authority and malformed keys', () => {
    expect(() => parseAction('SUBMIT', { ...submit, businessId: 'other' })).toThrow();
    expect(() => parseAction('SUBMIT', { ...submit, idempotencyKey: 'bad' })).toThrow();
  });
  it('requires full-intact receipt and a nonempty bounded rejection reason', () => {
    const transition = {
      requestId: 'r',
      expectedRevision: 1,
      idempotencyKey: key,
    };
    expect(() =>
      parseAction('RECEIVE', {
        ...transition,
        items: [{ productId: 'product', receivedQuantity: 2 }],
        allIntact: false,
      }),
    ).toThrow();
    expect(() => parseAction('REJECT', { ...transition, reason: '  ' })).toThrow();
    expect(() => parseAction('REJECT', { ...transition, reason: 'x'.repeat(501) })).toThrow();
    expect(
      parseAction('REJECT', { ...transition, reason: '  Out of stock  ' }).input,
    ).toMatchObject({ reason: 'Out of stock' });
  });
});

it('accepts_one_to_six_distinct_items_and_rejects_empty_duplicate_or_oversized_lists', () => {
  expect(parseAction('SUBMIT', submit).input).toEqual(submit);
  for (const items of [
    [],
    Array(7).fill({ productId: 'p', quantity: 2 }),
    [
      { productId: 'p', quantity: 1 },
      { productId: 'p', quantity: 2 },
    ],
  ])
    expect(() => parseAction('SUBMIT', { ...submit, items })).toThrow();
});
