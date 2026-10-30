import { describe, expect, it } from 'vitest';
import { pluralKey } from './plural';

describe('pluralKey', () => {
  it.each([
    [1, 'one'],
    [2, 'few'],
    [4, 'few'],
    [5, 'many'],
    [12, 'many'],
    [22, 'few'],
    [0, 'many'],
  ])('pl: %i -> %s', (n, form) => {
    expect(pluralKey('replenishment.items', n, 'pl')).toBe(`replenishment.items.${form}`);
  });

  it.each([
    [1, 'one'],
    [0, 'other'],
    [2, 'other'],
  ])('en: %i -> %s', (n, form) => {
    expect(pluralKey('replenishment.items', n, 'en')).toBe(`replenishment.items.${form}`);
  });
});
