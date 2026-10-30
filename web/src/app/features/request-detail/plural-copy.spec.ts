import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { expect, it } from 'vitest';
import pl from '../../../../public/i18n/pl.json';
import { pluralKey } from '../../core/i18n/plural';

it.each([
  ['items', 1, '1 item'],
  ['items', 2, '2 items'],
  ['items', 5, '5 items'],
  ['products', 1, '1 product'],
  ['products', 2, '2 products'],
  ['products', 5, '5 products'],
  ['units', 1, '1 unit'],
  ['units', 2, '2 units'],
  ['units', 5, '5 units'],
])('English %s count for %i', (noun, count, text) => {
  const t = TestBed.inject(TranslocoService);
  expect(t.translate(pluralKey(`requests.count.${noun}`, count, 'en'), { count })).toBe(text);
});

it.each([
  [1, '1 pozycja', '1 produkt', '1 sztuka'],
  [2, '2 pozycje', '2 produkty', '2 sztuki'],
  [5, '5 pozycji', '5 produktów', '5 sztuk'],
  [22, '22 pozycje', '22 produkty', '22 sztuki'],
  [12, '12 pozycji', '12 produktów', '12 sztuk'],
])('Polish counts for %i follow one / few / many', (count, items, products, units) => {
  const counts = pl.requests.count;
  const form = (base: Record<string, string>, key: string) =>
    base[key.slice(key.lastIndexOf('.') + 1)].replace('{{ count }}', String(count));
  expect(form(counts.items, pluralKey('requests.count.items', count, 'pl'))).toBe(items);
  expect(form(counts.products, pluralKey('requests.count.products', count, 'pl'))).toBe(products);
  expect(form(counts.units, pluralKey('requests.count.units', count, 'pl'))).toBe(units);
});
