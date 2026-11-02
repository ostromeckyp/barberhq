import { describe, expect, it } from 'vitest';
import { buildRequestPush } from '../../functions/src/push/messages.ts';

const base = { salonName: 'Salon A', requestRef: 'abcd1234', reason: null } as const;

describe('buildRequestPush', () => {
  const titles = {
    en: {
      RESERVED: 'Request approved',
      REJECTED: 'Request rejected',
      DISPATCHED: 'Delivery on the way',
    },
    pl: {
      RESERVED: 'Zamówienie zatwierdzone',
      REJECTED: 'Zamówienie odrzucone',
      DISPATCHED: 'Dostawa w drodze',
    },
  } as const;
  for (const locale of ['en', 'pl'] as const)
    for (const state of ['RESERVED', 'REJECTED', 'DISPATCHED'] as const)
      it(`titles ${state} in ${locale}`, () => {
        const m = buildRequestPush({ ...base, state, locale });
        expect(m.title).toBe(titles[locale][state]);
        expect(m.body).toBe('Salon A · #abcd1234');
      });

  it('appends the reason to a rejection', () => {
    const m = buildRequestPush({ ...base, state: 'REJECTED', locale: 'en', reason: 'No stock' });
    expect(m.body).toBe('Salon A · #abcd1234 — No stock');
  });

  it('truncates the reason at 100 characters with an ellipsis', () => {
    const m = buildRequestPush({
      ...base,
      state: 'REJECTED',
      locale: 'en',
      reason: 'x'.repeat(150),
    });
    expect(m.body).toBe(`Salon A · #abcd1234 — ${'x'.repeat(100)}…`);
    const exact = buildRequestPush({
      ...base,
      state: 'REJECTED',
      locale: 'en',
      reason: 'y'.repeat(100),
    });
    expect(exact.body.endsWith('…')).toBe(false);
  });

  it('ignores the reason for other states', () => {
    const m = buildRequestPush({ ...base, state: 'DISPATCHED', locale: 'en', reason: 'No' });
    expect(m.body).toBe('Salon A · #abcd1234');
  });

  it('falls back to en for an unknown locale', () => {
    const m = buildRequestPush({ ...base, state: 'RESERVED', locale: 'de' as 'en' });
    expect(m.title).toBe('Request approved');
  });
});
