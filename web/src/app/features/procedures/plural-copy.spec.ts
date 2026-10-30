import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { expect, it } from 'vitest';
import pl from '../../../../public/i18n/pl.json';
import { pluralKey } from '../../core/i18n/plural';

it.each([
  [1, '1 of 1 page reviewed'],
  [2, '1 of 2 pages reviewed'],
  [5, '1 of 5 pages reviewed'],
])('English review coverage for %i pages', (total, text) => {
  const t = TestBed.inject(TranslocoService);
  const key = pluralKey('procedures.review.coverage', total, 'en');
  expect(t.translate(key, { checked: 1, total })).toBe(text);
});

it.each([
  [1, '1 → 1 product'],
  [2, '1 → 2 products'],
  [5, '1 → 5 products'],
])('English impact counts for %i products', (after, text) => {
  const t = TestBed.inject(TranslocoService);
  const key = pluralKey('procedures.product.impactCounts', after, 'en');
  expect(t.translate(key, { before: 1, after })).toBe(text);
});

it('Polish forms follow one / few / many', () => {
  const impact = pl.procedures.product.impactCounts;
  const coverage = pl.procedures.review.coverage;
  expect(pluralKey('procedures.product.impactCounts', 1, 'pl')).toBe(
    'procedures.product.impactCounts.one',
  );
  expect(impact.one).toContain('produkt');
  expect(impact.few).toContain('produkty');
  expect(impact.many).toContain('produktów');
  expect(coverage.one).toContain('z {{ total }} strony');
  expect(coverage.many).toContain('z {{ total }} stron');
});
