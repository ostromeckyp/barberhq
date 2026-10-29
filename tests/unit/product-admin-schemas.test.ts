import { describe, expect, it } from 'vitest';
import {
  parseCreateProduct,
  parseSetHqStock,
  parseUpdateProduct,
} from '../../functions/src/products/schemas.ts';

const form = {
  name: 'Pomada Testowa',
  brand: 'Not Bad Stuff',
  category: 'Pomady',
  type: 'pomada',
  summary: 'Medium hold.',
  scent: null,
  netContentMl: 100,
  retailPriceGrosz: 6900,
  sourceCode: '5900000000001',
  sourceUrl: 'https://example.com/p',
  observedOn: '2026-10-28',
};
const key = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('product admin input', () => {
  it('accepts a complete form and trims text', () => {
    expect(
      parseCreateProduct({
        form: { ...form, name: '  Pomada Testowa ' },
        hqOnHand: 5,
        idempotencyKey: key,
      }).form.name,
    ).toBe('Pomada Testowa');
  });
  it.each([
    ['empty name', { name: ' ' }],
    ['unknown category', { category: 'Szampony' }],
    ['long name', { name: 'x'.repeat(121) }],
    ['negative price', { retailPriceGrosz: -1 }],
    ['fractional price', { retailPriceGrosz: 1.5 }],
    ['zero ml', { netContentMl: 0 }],
    ['http url', { sourceUrl: 'http://example.com' }],
    ['bad date', { observedOn: '28.10.2026' }],
    ['empty code', { sourceCode: '' }],
    ['unknown key', { demoId: 'X' }],
  ])('rejects %s', (_, patch) => {
    expect(() =>
      parseCreateProduct({ form: { ...form, ...patch }, hqOnHand: 1, idempotencyKey: key }),
    ).toThrow();
  });
  it('rejects forged scope and bad quantities', () => {
    expect(() => parseCreateProduct({ form, hqOnHand: -1, idempotencyKey: key })).toThrow();
    expect(() =>
      parseCreateProduct({ form, hqOnHand: 1, idempotencyKey: key, businessId: 'b' }),
    ).toThrow();
    expect(() =>
      parseSetHqStock({
        productId: 'p',
        expectedVersion: 1,
        onHand: 2147483648,
        idempotencyKey: key,
      }),
    ).toThrow();
    expect(() =>
      parseSetHqStock({ productId: 'p', expectedVersion: 0, onHand: 1, idempotencyKey: key }),
    ).toThrow();
    expect(
      parseSetHqStock({ productId: 'p', expectedVersion: 1, onHand: 0, idempotencyKey: key })
        .onHand,
    ).toBe(0);
    expect(() =>
      parseUpdateProduct({
        productId: 'p',
        expectedRevision: -1,
        form,
        idempotencyKey: key,
      }),
    ).toThrow();
  });
});
