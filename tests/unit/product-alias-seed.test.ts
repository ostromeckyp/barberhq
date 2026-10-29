import { describe, expect, it } from 'vitest';
import {
  parseAliasSeedArgs,
  planProductAliasSeed,
  readAliasSeed,
  seedAliasId,
  type AliasSeedState,
} from '../../scripts/seed/product-aliases.ts';

// Aliases are seed data owned by the products in data/seed/business.json; no code knows them.
const file = readAliasSeed();
const business = 'biz';
function empty(): AliasSeedState {
  return {
    revision: 3,
    products: file.products.map((p) => ({
      id: `${business}:${p.demoId}`,
      demoId: p.demoId,
      seedType: null,
      keywords: [],
      typeSourceVersionId: null,
    })),
    aliases: [],
  };
}
function applied(state: AliasSeedState): AliasSeedState {
  const plan = planProductAliasSeed(file, business, state);
  return {
    revision: state.revision + (plan.changed ? 1 : 0),
    products: state.products.map((p) => ({ ...p, ...plan.products.find((x) => x.id === p.id) })),
    aliases: [
      ...state.aliases
        .filter((a) => !plan.upserts.some((u) => u.id === a.id))
        .map((a) => (plan.retire.includes(a.id) ? { ...a, status: 'RETIRED' as const } : a)),
      ...plan.upserts.map((u) => ({ ...u, status: 'ACTIVE' as const })),
    ],
  };
}

describe('product alias seed data', () => {
  it('reads aliases from the products of the business seed, phonetics included', () => {
    expect(file.businessKey).toBe('not-bad-stuff-demo');
    const dry = file.products.find((p) => p.demoId === 'NBS-DRYMATT-100')!;
    expect(dry.aliases).toContainEqual({ phrase: 'drajmat', kind: 'PHONETIC', lang: 'pl' });
    expect(dry.type).toBe('pomada');
  });
  it('moves every previously hard-coded phrase into classified data', () => {
    const phrases = file.products.flatMap((p) => p.aliases.map((a) => `${p.demoId}/${a.phrase}`));
    for (const expected of [
      'NBS-MATOWA-100/matowej',
      'NBS-DRYMATT-100/drymatt',
      'NBS-CEMENT-100/cement pomade',
      'NBS-SOL-200/soli morskiej',
      'NBS-SAVAGE-50/olejek savage',
      'NBS-MATTIFIER-100/matte pomade',
    ])
      expect(phrases).toContain(expected);
    expect(
      file.products.every(
        (p) => p.type && p.aliases.every((a) => ['NAME', 'TYPE', 'PHONETIC'].includes(a.kind)),
      ),
    ).toBe(true);
    const matte = file.products.filter((p) => p.aliases.some((a) => a.phrase === 'matte'));
    expect(matte.length).toBeGreaterThan(1);
    expect(matte.every((p) => p.aliases.find((a) => a.phrase === 'matte')!.kind === 'TYPE')).toBe(
      true,
    );
  });
  it('derives deterministic identities from business/product/kind/base phrase/language', () => {
    expect(seedAliasId('b', 'p', 'NAME', 'Sól  Morska', 'pl')).toBe(
      seedAliasId('b', 'p', 'NAME', 'sol morska', 'pl'),
    );
    expect(seedAliasId('b', 'p', 'NAME', 'sol', 'pl')).not.toBe(
      seedAliasId('b', 'p', 'TYPE', 'sol', 'pl'),
    );
    expect(seedAliasId('b', 'p', 'NAME', 'sol', 'pl')).not.toBe(
      seedAliasId('c', 'p', 'NAME', 'sol', 'pl'),
    );
  });
});

describe('planProductAliasSeed', () => {
  it('plans all aliases and product metadata once, then nothing', () => {
    const plan = planProductAliasSeed(file, business, empty());
    expect(plan).toMatchObject({ changed: true, expectedRevision: 3, retire: [] });
    expect(plan.upserts.length).toBe(file.products.flatMap((p) => p.aliases).length);
    expect(
      plan.upserts.every((u) => u.id.startsWith('seed:') && u.normalized === u.normalized.trim()),
    ).toBe(true);
    expect(plan.products).toHaveLength(6);
    const again = planProductAliasSeed(file, business, applied(empty()));
    expect(again).toMatchObject({ changed: false, upserts: [], retire: [], products: [] });
  });
  it('retires only removed SEED rows and never touches other sources', () => {
    const state = applied(empty());
    const productId = `${business}:NBS-CEMENT-100`;
    state.aliases.push(
      {
        id: 'seed:gone',
        productId,
        phrase: 'old',
        normalized: 'old',
        kind: 'NAME',
        lang: 'pl',
        source: 'SEED',
        status: 'ACTIVE',
      },
      {
        id: 'hq-row',
        productId,
        phrase: 'hq',
        normalized: 'hq',
        kind: 'NAME',
        lang: 'pl',
        source: 'HQ',
        status: 'ACTIVE',
      },
      {
        id: 'salon-row',
        productId,
        phrase: 'x',
        normalized: 'x',
        kind: 'NAME',
        lang: 'und',
        source: 'SALON_CONFIRMED',
        status: 'ACTIVE',
      },
    );
    const plan = planProductAliasSeed(file, business, state);
    expect(plan).toMatchObject({ changed: true, retire: ['seed:gone'], upserts: [], products: [] });
  });
  it('never reactivates or retires a seed row HQ overrode in the app', () => {
    const state = applied(empty());
    state.aliases[0] = { ...state.aliases[0], status: 'RETIRED', overriddenByHq: true };
    const plan = planProductAliasSeed(file, business, state);
    expect(plan.upserts.map((u) => u.id)).not.toContain(state.aliases[0].id);
    expect(plan.changed).toBe(false);
  });
  it('reactivates a retired seed row that is back in data', () => {
    const state = applied(empty());
    state.aliases[0] = { ...state.aliases[0], status: 'RETIRED' };
    expect(planProductAliasSeed(file, business, state).upserts.map((u) => u.id)).toEqual([
      state.aliases[0].id,
    ]);
  });
  it('rejects a catalog that lacks a seeded product instead of guessing', () => {
    const state = empty();
    state.products.pop();
    expect(() => planProductAliasSeed(file, business, state)).toThrow(/product/i);
  });
});

describe('parseAliasSeedArgs', () => {
  const base = [
    '--project',
    'demo-barberhq',
    '--business',
    'biz',
    '--config',
    'config/emulator.example.json',
  ];
  it('requires explicit project/business/config and exactly one mode', () => {
    expect(parseAliasSeedArgs([...base, '--dry-run'])).toEqual({
      projectId: 'demo-barberhq',
      businessId: 'biz',
      configPath: 'config/emulator.example.json',
      apply: false,
    });
    expect(parseAliasSeedArgs([...base, '--apply']).apply).toBe(true);
    expect(() => parseAliasSeedArgs(base)).toThrow();
    expect(() => parseAliasSeedArgs([...base, '--dry-run', '--apply'])).toThrow();
    expect(() => parseAliasSeedArgs(['--business', 'biz', '--config', 'c', '--dry-run'])).toThrow();
  });
});
