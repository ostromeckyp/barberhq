import { describe, expect, it } from 'vitest';
import { normalizeProductForMatch } from '../../functions/src/ai/product-lookup.ts';
import { readAliasSeed } from '../../scripts/seed/product-aliases.ts';

// Owner-approved extra phonetic spellings (2026-11-03) for voice ordering.
const approved: Record<string, string[]> = {
  'NBS-DRYMATT-100': [
    'draj matt',
    'draimat',
    'drai mat',
    'draymat',
    'dry met',
    'draj met',
    'tri mat',
  ],
  'NBS-SAVAGE-50': ['saważe', 'saaże', 'savaż', 'sewedż', 'sewydż', 'sawicz', 'sawage', 'sevage'],
  'NBS-MATTIFIER-100': ['matifier', 'matyfier', 'metifajer', 'matifaj', 'mati fajer', 'matifire'],
  'NBS-CEMENT-100': ['siment', 'sement', 'cemen', 'cemęt', 'cementowa'],
  'NBS-SOL-200': ['si solt', 'sisolt', 'sea solt', 'morska sól', 'solka morska', 'sól do włosów'],
  'NBS-MATOWA-100': ['matówka', 'matowych'],
};

describe('extra phonetic aliases in the demo seed', () => {
  const file = readAliasSeed();

  it('has every approved phrase as a pl PHONETIC alias of its product', () => {
    for (const [demoId, phrases] of Object.entries(approved)) {
      const product = file.products.find((p) => p.demoId === demoId)!;
      for (const phrase of phrases)
        expect(product.aliases, `${demoId}/${phrase}`).toContainEqual({
          phrase,
          kind: 'PHONETIC',
          lang: 'pl',
        });
    }
  });

  // Older aliases already share TYPE phrases ("matte") by design; only the new ones are checked.
  const isNew = (demoId: string, phrase: string) => approved[demoId]?.includes(phrase) ?? false;
  const entries = file.products.flatMap((p) =>
    p.aliases.map((a) => ({
      demoId: p.demoId,
      phrase: a.phrase,
      key: normalizeProductForMatch(a.phrase),
      added: isNew(p.demoId, a.phrase),
    })),
  );

  it('does not duplicate another alias of the same product after normalization', () => {
    for (const e of entries.filter((x) => x.added))
      expect(
        entries.filter((x) => x.demoId === e.demoId && x.key === e.key),
        `${e.demoId}/${e.phrase}`,
      ).toHaveLength(1);
  });

  it('does not collide with an alias of another product after normalization', () => {
    for (const e of entries.filter((x) => x.added))
      expect(
        entries.filter((x) => x.demoId !== e.demoId && x.key === e.key),
        `${e.demoId}/${e.phrase}`,
      ).toEqual([]);
  });
});
