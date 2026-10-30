import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { expect, it } from 'vitest';
import en from '../../../../public/i18n/en.json';
import pl from '../../../../public/i18n/pl.json';
import { pluralKey } from '../../core/i18n/plural';

it.each([
  ['dispatched', 1, '1 unit dispatched'],
  ['dispatched', 2, '2 units dispatched'],
  ['dispatched', 5, '5 units dispatched'],
  ['goodUnits', 1, '1 good unit'],
  ['goodUnits', 2, '2 good units'],
  ['goodUnits', 5, '5 good units'],
  ['reported', 1, '1 unit will be reported to HQ for replacement.'],
  ['reported', 2, '2 units will be reported to HQ for replacement.'],
  ['remaining', 1, '1 unit remaining'],
  ['remaining', 2, '2 units remaining'],
  ['remaining', 5, '5 units remaining'],
])('English %s count for %i', (noun, count, text) => {
  const t = TestBed.inject(TranslocoService);
  expect(t.translate(pluralKey(`delivery.count.${noun}`, count, 'en'), { count })).toBe(text);
});

it.each([
  [1, 'Pozostała 1 sztuka', 'Wysłano 1 sztukę', '1 sztuka w dobrym stanie'],
  [2, 'Pozostały 2 sztuki', 'Wysłano 2 sztuki', '2 sztuki w dobrym stanie'],
  [5, 'Pozostało 5 sztuk', 'Wysłano 5 sztuk', '5 sztuk w dobrym stanie'],
  [22, 'Pozostały 22 sztuki', 'Wysłano 22 sztuki', '22 sztuki w dobrym stanie'],
  [12, 'Pozostało 12 sztuk', 'Wysłano 12 sztuk', '12 sztuk w dobrym stanie'],
])('Polish counts for %i follow one / few / many', (count, remaining, dispatched, good) => {
  const counts = pl.delivery.count;
  const form = (base: Record<string, string>, key: string) =>
    base[key.slice(key.lastIndexOf('.') + 1)].replace('{{ count }}', String(count));
  expect(form(counts.remaining, pluralKey('delivery.count.remaining', count, 'pl'))).toBe(
    remaining,
  );
  expect(form(counts.dispatched, pluralKey('delivery.count.dispatched', count, 'pl'))).toBe(
    dispatched,
  );
  expect(form(counts.goodUnits, pluralKey('delivery.count.goodUnits', count, 'pl'))).toBe(good);
});

it('keeps the same plural forms in both languages', () => {
  for (const noun of Object.keys(en.delivery.count))
    expect(Object.keys(pl.delivery.count[noun as keyof typeof pl.delivery.count])).toEqual(
      Object.keys(en.delivery.count[noun as keyof typeof en.delivery.count]),
    );
});
