import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { expect, it } from 'vitest';
import pl from '../../../../public/i18n/pl.json';
import { pluralKey } from '../../core/i18n/plural';

it.each([
  [1, '1 product'],
  [2, '2 products'],
  [5, '5 products'],
])('English product count for %i', (count, text) => {
  const t = TestBed.inject(TranslocoService);
  expect(t.translate(pluralKey('requests.count.products', count, 'en'), { count })).toBe(text);
});

it.each([
  [1, '1 produkt'],
  [2, '2 produkty'],
  [5, '5 produktów'],
  [22, '22 produkty'],
  [12, '12 produktów'],
])('Polish product count for %i follows one / few / many', (count, text) => {
  const key = pluralKey('requests.count.products', count, 'pl');
  const form = pl.requests.count.products[key.slice(key.lastIndexOf('.') + 1) as 'one'];
  expect(form.replace('{{ count }}', String(count))).toBe(text);
});
