import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DataConnect } from 'firebase-admin/data-connect';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { createReplenishmentRepository } from '../../functions/src/ai/replenishment-repository.ts';
import {
  readAliasSeedState,
  runProductAliasSeed,
  readAliasSeed,
} from '../../scripts/seed/product-aliases.ts';
import { createLookupHarness, type LookupHarness } from '../support/replenishment.ts';

const budget = () => createAiBudget(Date.now());

describe('Feature: complete scoped replenishment snapshots', () => {
  let h: LookupHarness;
  beforeEach(async () => {
    h = await createLookupHarness();
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  const read = (
    actor: keyof LookupHarness['actors'],
    salonId = h.legnickaId,
    dc: DataConnect = h.dc,
  ) => createReplenishmentRepository(dc).readContext(h.actors[actor], salonId, budget());

  it('reads every product with selected salon stock, eligible aliases and own shorthand', async () => {
    await h.addAliases([
      { productId: h.productId('NBS-CEMENT-100'), phrase: 'beton', normalized: 'beton' },
      {
        productId: h.productId('NBS-MATOWA-100'),
        phrase: 'ma',
        normalized: 'ma',
        source: 'SALON_CONFIRMED',
        salonId: h.legnickaId,
        lang: 'und',
      },
      {
        productId: h.productId('NBS-SOL-200'),
        phrase: 'sol',
        normalized: 'sol',
        source: 'SALON_CONFIRMED',
        salonId: h.lodzkaId,
        lang: 'und',
      },
    ]);
    const context = await read('legnicka');
    expect(context.products).toHaveLength(6);
    const matowa = context.products.find((p) => p.productId === h.productId('NBS-MATOWA-100'))!;
    expect(matowa).toMatchObject({
      productName: 'Pomada Matowa',
      sourceCode: '5905191055165',
      category: 'Pomady',
      keywords: [],
      hqAvailable: 18,
      salonOnHand: 2,
      activeRequestId: null,
    });
    expect(context.aliases.map((a) => [a.phrase, a.source, a.salonId])).toEqual(
      expect.arrayContaining([
        ['beton', 'SEED', null],
        ['ma', 'SALON_CONFIRMED', h.legnickaId],
      ]),
    );
    expect(context.aliases.some((a) => a.salonId === h.lodzkaId)).toBe(false);
    expect(context).toMatchObject({ catalogRevision: expect.any(Number), salonAliasRevision: 0 });
  });

  it('pages across product boundaries and finds selected salon stock beyond 100 other salons', async () => {
    const extra = await h.addProducts(99);
    const salons = Array.from({ length: 101 }, (_, i) => `${h.businessId}:other-${i}`);
    await h.insertMany(
      'location',
      salons.map((id, i) => ({
        id,
        businessId: h.businessId,
        key: `other-${i}`,
        name: `Other ${i}`,
        kind: 'SALON',
      })),
    );
    await h.insertMany(
      'inventory',
      salons.map((locationId) => ({ locationId, productId: extra[98], onHand: 1 })),
    );
    const context = await read('hq');
    expect(context.products).toHaveLength(105);
    expect(context.products.find((p) => p.productId === extra[98])).toMatchObject({
      hqAvailable: 5,
      salonOnHand: 5,
    });
  });

  it('fails explicitly instead of truncating more than 200 products', async () => {
    await h.addProducts(195, false);
    await expect(read('hq')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('fails explicitly on more than 5000 global or 200 salon aliases', async () => {
    const productId = h.productId('NBS-CEMENT-100');
    await h.addAliases(
      Array.from({ length: 201 }, (_, i) => ({
        productId,
        phrase: `s${i}`,
        normalized: `s${i}`,
        source: 'SALON_CONFIRMED',
        salonId: h.legnickaId,
        lang: 'und',
      })),
    );
    await expect(read('legnicka')).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    await expect(read('lodzka', h.lodzkaId)).resolves.toBeTruthy();
    await h.addAliases(
      Array.from({ length: 5001 }, (_, i) => ({ productId, phrase: `g${i}`, normalized: `g${i}` })),
    );
    await expect(read('lodzka', h.lodzkaId)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('ignores ACTIVE rows whose source or scope is ineligible', async () => {
    const productId = h.productId('NBS-CEMENT-100');
    const documentId = `doc-${randomUUID()}`;
    const draft = `ver-${randomUUID()}`;
    const published = `ver-${randomUUID()}`;
    await h.gql('mutation($d:KnowledgeDocument_Data!){knowledgeDocument_insert(data:$d)}', {
      d: { id: documentId, businessId: h.businessId, documentCode: documentId },
    });
    const version = (id: string, label: string, extra: object) => ({
      id,
      documentId,
      businessId: h.businessId,
      versionLabel: label,
      title: 't',
      language: 'pl',
      synthetic: true,
      sourceUrls: [],
      pdfSha256: 'x',
      ...extra,
    });
    await h.gql(
      'mutation($rows:[KnowledgeVersion_Data!]!){knowledgeVersion_insertMany(data:$rows)}',
      {
        rows: [
          version(draft, 'a', { status: 'EXTRACTED' }),
          version(published, 'b', {
            status: 'READY',
            isActive: true,
            publishedAt: new Date().toISOString(),
          }),
        ],
      },
    );
    await h.gql(
      'mutation($id:String!,$v:String!){knowledgeDocument_update(id:$id,data:{activeVersionId:$v})}',
      {
        id: documentId,
        v: published,
      },
    );
    await h.addAliases([
      {
        productId,
        phrase: 'draft',
        normalized: 'draft',
        source: 'GENERATED',
        sourceDocumentVersionId: draft,
      },
      { productId, phrase: 'orphan', normalized: 'orphan', source: 'HQ' },
      {
        productId,
        phrase: 'current',
        normalized: 'current',
        source: 'GENERATED',
        sourceDocumentVersionId: published,
      },
      { productId, phrase: 'scoped', normalized: 'scoped', salonId: h.legnickaId },
      {
        productId,
        phrase: 'docsalon',
        normalized: 'docsalon',
        source: 'SALON_CONFIRMED',
        salonId: h.legnickaId,
        sourceDocumentVersionId: published,
        lang: 'und',
      },
      { productId, phrase: 'retired', normalized: 'retired', status: 'RETIRED' },
      { productId, phrase: 'proposed', normalized: 'proposed', status: 'PROPOSED' },
    ]);
    const phrases = (await read('legnicka')).aliases.map((a) => a.phrase);
    // A source-less HQ row is a product-owned alias (HQ product management) and is eligible.
    expect(phrases.sort()).toEqual(['current', 'orphan']);
  });

  it('denies foreign business, other salon, role mismatch and revoked access', async () => {
    await expect(read('foreign')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(read('legnicka', h.lodzkaId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const repo = createReplenishmentRepository(h.dc);
    await expect(
      repo.readContext({ ...h.actors.legnicka, role: 'HQ' }, h.legnickaId, budget()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await h.gql('mutation($uid:String!){salonAccess_deleteMany(where:{membershipUid:{eq:$uid}})}', {
      uid: h.users.legnicka,
    });
    await expect(read('legnicka')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a snapshot whose catalog or salon shorthand changed while paging', async () => {
    const bumpOnce = (mutation: string, variables: object) => {
      let done = false;
      return new Proxy(h.dc, {
        get(target, prop, receiver) {
          if (prop !== 'executeQuery') return Reflect.get(target, prop, receiver);
          return async (name: string, vars: object) => {
            const result = await target.executeQuery(name, vars);
            if (name === 'ReadReplenishmentProductPage' && !done) {
              done = true;
              await h.gql(mutation, variables);
            }
            return result;
          };
        },
      });
    };
    await expect(
      read(
        'legnicka',
        h.legnickaId,
        bumpOnce(
          'mutation($id:String!){business_update(id:$id,data:{productKnowledgeRevision_update:{inc:1}})}',
          {
            id: h.businessId,
          },
        ),
      ),
    ).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
    await expect(
      read(
        'legnicka',
        h.legnickaId,
        bumpOnce(
          'mutation($id:String!){location_update(id:$id,data:{productAliasRevision_update:{inc:1}})}',
          {
            id: h.legnickaId,
          },
        ),
      ),
    ).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
  });
});

describe('Feature: reviewed product alias seed', () => {
  let h: LookupHarness;
  beforeEach(async () => {
    h = await createLookupHarness('seed');
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  const file = () => readAliasSeed();
  const revision = async () => (await readAliasSeedState(h.dc, h.businessId)).revision;

  it('dry-run writes nothing; apply is idempotent and bumps the revision once', async () => {
    const before = await readAliasSeedState(h.dc, h.businessId);
    expect(await runProductAliasSeed(h.dc, file(), h.businessId, false)).toMatchObject({
      applied: false,
      upserts: 32,
    });
    expect(await readAliasSeedState(h.dc, h.businessId)).toEqual(before);
    expect(await runProductAliasSeed(h.dc, file(), h.businessId, true)).toMatchObject({
      applied: true,
    });
    expect(await revision()).toBe(before.revision + 1);
    expect(await runProductAliasSeed(h.dc, file(), h.businessId, true)).toMatchObject({
      applied: false,
      upserts: 0,
      retire: 0,
      products: 0,
    });
    expect(await revision()).toBe(before.revision + 1);
    const context = await createReplenishmentRepository(h.dc).readContext(
      h.actors.legnicka,
      h.legnickaId,
      budget(),
    );
    expect(context.aliases.filter((a) => a.source === 'SEED')).toHaveLength(32);
    expect(
      context.products.find((p) => p.productId === h.productId('NBS-SAVAGE-50')),
    ).toMatchObject({
      type: 'olejek do brody',
      keywords: ['broda', 'zarost'],
    });
  });

  it('changes once, retires only removed seed rows and keeps other sources and document types', async () => {
    const cement = h.productId('NBS-CEMENT-100');
    await h.addAliases([
      { productId: cement, phrase: 'hq', normalized: 'hq', source: 'HQ', status: 'PROPOSED' },
      {
        productId: cement,
        phrase: 'mine',
        normalized: 'mine',
        source: 'SALON_CONFIRMED',
        salonId: h.legnickaId,
        lang: 'und',
      },
    ]);
    await h.gql(
      'mutation($id:String!){product_update(id:$id,data:{type:"z dokumentu",typeSourceVersionId:"doc-v"})}',
      { id: cement },
    );
    await runProductAliasSeed(h.dc, file(), h.businessId, true);
    const start = await revision();
    const changed = file();
    changed.products[2].aliases.pop();
    changed.products[2].type = 'pasta';
    expect(await runProductAliasSeed(h.dc, changed, h.businessId, true)).toMatchObject({
      applied: true,
      retire: 1,
      products: 1,
    });
    expect(await revision()).toBe(start + 1);
    const rows = await h.gql<{
      productAliases: { phrase: string; source: string; status: string }[];
      product: { type: string; seedType: string };
    }>(
      'query($b:String!,$p:String!){productAliases(where:{businessId:{eq:$b},productId:{eq:$p}},orderBy:{phrase:ASC}){phrase source status} product(id:$p){type seedType}}',
      { b: h.businessId, p: cement },
    );
    expect(rows.productAliases.map((r) => [r.phrase, r.source, r.status])).toEqual([
      ['cement', 'SEED', 'ACTIVE'],
      ['cement pomade', 'SEED', 'RETIRED'],
      ['hq', 'HQ', 'PROPOSED'],
      ['mine', 'SALON_CONFIRMED', 'ACTIVE'],
    ]);
    expect(rows.product).toEqual({ type: 'z dokumentu', seedType: 'pasta' });
  });

  it('rejects a stale expected revision without partial writes', async () => {
    const dc = new Proxy(h.dc, {
      get(target, prop, receiver) {
        if (prop !== 'executeMutation') return Reflect.get(target, prop, receiver);
        return async (name: string, vars: object) => {
          await h.gql(
            'mutation($id:String!){business_update(id:$id,data:{productKnowledgeRevision_update:{inc:1}})}',
            { id: h.businessId },
          );
          return target.executeMutation(name, vars);
        };
      },
    });
    await expect(runProductAliasSeed(dc, file(), h.businessId, true)).rejects.toThrow(
      /STALE_STATE/,
    );
    expect((await readAliasSeedState(h.dc, h.businessId)).aliases).toEqual([]);
  });
});
