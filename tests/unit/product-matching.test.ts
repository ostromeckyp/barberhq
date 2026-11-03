import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { createAiRuntime } from '../../functions/src/ai/runtime.ts';
import {
  createProductMatcher,
  productMatchingInstruction,
} from '../../functions/src/ai/product-matching.ts';
import type { MatchRequest } from '../../functions/src/ai/models/match-request.ts';

const request: MatchRequest = {
  language: 'pl',
  lines: [
    {
      lineId: 'line-0-7',
      originalWording: '2 Betta',
      productQuery: 'Betta',
      tier: 'NONE',
      candidateIds: ['a', 'b'],
    },
  ],
  catalog: [
    {
      productId: 'a',
      name: 'Alfa',
      type: 'pomada',
      category: 'styling',
      keywords: ['mat'],
      aliases: ['alfa'],
      salonShorthand: [],
    },
    {
      productId: 'b',
      name: 'Beta',
      type: '',
      category: 'care',
      keywords: [],
      aliases: ['bita'],
      salonShorthand: ['betka'],
    },
  ],
};
function setup(output: unknown) {
  const ai = createAiRuntime({
    provider: 'vertex',
    projectId: 'notbad-6be95',
    location: 'eu',
    modelId: 'gemini-3.5-flash-lite',
  });
  const generate = vi.spyOn(ai, 'generate').mockResolvedValue({ output } as never);
  return { match: createProductMatcher(ai), generate };
}

describe('matchProducts model turn', () => {
  it('sends the lines and catalog card as data and returns the parsed result', async () => {
    const output = {
      lines: [{ lineId: 'line-0-7', productIds: ['b'], confidence: 'HIGH', reason: 'Jak Beta.' }],
    };
    const { match, generate } = setup(output);
    const budget = createAiBudget(Date.now());
    await expect(match(budget, request)).resolves.toEqual(output);
    expect(budget.modelTurnsRemaining).toBe(4);
    expect(generate).toHaveBeenCalledOnce();
    const options = generate.mock.calls[0][0] as unknown as {
      system: string;
      prompt: string;
      maxTurns: number;
      output: { schema: unknown };
      abortSignal: AbortSignal;
    };
    expect(options.system).toBe(productMatchingInstruction('pl'));
    expect(options.system).toContain('Polish');
    expect(JSON.parse(options.prompt)).toEqual(request);
    expect(options.maxTurns).toBe(1);
    expect(options.output.schema).toBeDefined();
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
  });
  it('rejects output that does not fit the schema', async () => {
    for (const output of [
      null,
      { lines: [{ lineId: 'line-0-7', productIds: ['b'], confidence: 'SURE', reason: '' }] },
      { lines: [{ lineId: 'x', productIds: ['a', 'b', 'c', 'd'], confidence: 'LOW', reason: '' }] },
      { lines: [], extra: true },
    ]) {
      const { match } = setup(output);
      await expect(match(createAiBudget(Date.now()), request)).rejects.toMatchObject({
        code: 'INVALID_MODEL_OUTPUT',
      });
    }
  });
  it('asks for the reason in the UI language', () => {
    expect(productMatchingInstruction('en')).toContain('English');
    expect(productMatchingInstruction('pl')).toContain('Polish');
  });
  it('carries no product knowledge: no seed product name or alias in the prompt', () => {
    const seed = JSON.parse(readFileSync('data/seed/business.json', 'utf8')) as {
      products: { name: string; brand?: string; aliases?: { phrase: string }[] }[];
    };
    const words = seed.products.flatMap((p) => [
      p.name,
      ...(p.brand ? [p.brand] : []),
      ...(p.aliases ?? []).map((a) => a.phrase),
    ]);
    for (const language of ['pl', 'en'] as const) {
      const text = productMatchingInstruction(language).toLowerCase();
      expect(words.filter((w) => w.length >= 4 && text.includes(w.toLowerCase()))).toEqual([]);
    }
  });
});
