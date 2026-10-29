import { describe, expect, it } from 'vitest';
import { isReplenishmentProposal } from './replenishment-proposal';

const receipt = '0f8fad5b-d9cb-469f-a165-70867728950e';
const candidates = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ productId: `p-${i}`, productName: `Product ${i}` }));
const clarification = (extra: object = {}) => ({
  status: 'NEEDS_CLARIFICATION',
  excluded: [],
  toolEvents: [],
  lines: [
    {
      status: 'NEEDS_CLARIFICATION',
      lineId: 'line-0-7',
      originalWording: '2 pasta',
      reason: 'Choose a catalog product.',
      origin: 'assistant',
      candidates: candidates(3),
      ...extra,
    },
  ],
});

describe('isReplenishmentProposal', () => {
  it('accepts up to 200 distinct candidates on a line, not more', () => {
    expect(isReplenishmentProposal(clarification({ candidates: candidates(200) }))).toBe(true);
    expect(isReplenishmentProposal(clarification({ candidates: candidates(201) }))).toBe(false);
  });
  it('rejects duplicate or malformed candidate identities', () => {
    const dup = [...candidates(2), candidates(1)[0]];
    expect(isReplenishmentProposal(clarification({ candidates: dup }))).toBe(false);
    for (const productId of ['a b', 'x'.repeat(201), 'a\u0000b'])
      expect(
        isReplenishmentProposal(clarification({ candidates: [{ productId, productName: 'P' }] })),
      ).toBe(false);
  });
  it('accepts an opaque UUID receipt and rejects malformed receipt identity', () => {
    expect(isReplenishmentProposal(clarification({ choiceReceiptId: receipt }))).toBe(true);
    for (const choiceReceiptId of ['', 'not-a-receipt', 7, `${receipt}x`])
      expect(isReplenishmentProposal(clarification({ choiceReceiptId }))).toBe(false);
  });
  it('validates the optional bounded shorthand learning outcome', () => {
    const ok = {
      ...clarification(),
      shorthandLearning: [{ lineId: 'line-9-12', status: 'NOT_SAVED', reason: 'EXPIRED' }],
    };
    expect(isReplenishmentProposal(ok)).toBe(true);
    expect(
      isReplenishmentProposal({ ...ok, shorthandLearning: [{ lineId: 'l', status: 'LEARNED' }] }),
    ).toBe(true);
    for (const shorthandLearning of [
      [{ lineId: 'l', status: 'SAVED' }],
      [{ lineId: 'l', status: 'NOT_SAVED', reason: 'OOPS' }],
      [
        { lineId: 'l', status: 'LEARNED' },
        { lineId: 'l', status: 'LEARNED' },
      ],
      Array.from({ length: 7 }, (_, i) => ({ lineId: `l${i}`, status: 'LEARNED' })),
      'LEARNED',
    ])
      expect(isReplenishmentProposal({ ...ok, shorthandLearning })).toBe(false);
  });
  it('still limits a proposal to six request lines', () => {
    const base = clarification();
    const lines = Array.from({ length: 7 }, (_, i) => ({ ...base.lines[0], lineId: `line-${i}` }));
    expect(isReplenishmentProposal({ ...base, lines })).toBe(false);
  });
});
