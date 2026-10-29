import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import { lookupProducts } from '../../functions/src/ai/product-lookup.ts';
import { createReplenishmentRepository } from '../../functions/src/ai/replenishment-repository.ts';
import { createProductAliasCommands } from '../../functions/src/products/aliases.ts';
import {
  readAliasSeedState,
  runProductAliasSeed,
  readAliasSeed,
} from '../../scripts/seed/product-aliases.ts';
import { createLookupHarness, type LookupHarness } from '../support/replenishment.ts';

describe('Feature: product-owned aliases edited by HQ', () => {
  let h: LookupHarness;
  beforeEach(async () => {
    h = await createLookupHarness('aliases');
  });
  afterEach(async () => {
    if (h) await h.dispose();
  });
  const aliases = () => createProductAliasCommands(h.dc);
  const save = (uid: string, productId: string, changes: unknown[]) =>
    aliases().save(uid, { productId, changes, idempotencyKey: randomUUID() });
  const resolve = async (phrase: string) => {
    const context = await createReplenishmentRepository(h.dc).readContext(
      h.actors.legnicka,
      h.legnickaId,
      createAiBudget(Date.now()),
    );
    const match = lookupProducts(phrase, context.products, context.aliases, h.legnickaId);
    return [match.match, match.candidates.map((c) => c.productId)];
  };
  const seed = () => runProductAliasSeed(h.dc, readAliasSeed(), h.businessId, true);
  const cement = () => h.productId('NBS-CEMENT-100');

  it('adds an HQ alias the assistant resolves at once, and bumps the catalog revision', async () => {
    const before = (await readAliasSeedState(h.dc, h.businessId)).revision;
    const result = await save(h.users.hq, cement(), [
      { op: 'add', phrase: 'betonik', kind: 'PHONETIC' },
    ]);
    expect(result.aliases).toEqual([
      expect.objectContaining({
        phrase: 'betonik',
        kind: 'PHONETIC',
        source: 'HQ',
        editable: true,
        revision: 1,
      }),
    ]);
    expect(await resolve('betoniki')).toEqual(['PHONETIC', [cement()]]);
    expect((await readAliasSeedState(h.dc, h.businessId)).revision).toBe(before + 1);
  });

  it('overrides seed rows on edit/remove and the seed never brings them back', async () => {
    await seed();
    const listed = (await aliases().list(h.users.hq, cement())).aliases;
    const cementPomade = listed.find((a) => a.phrase === 'cement pomade')!;
    const cementName = listed.find((a) => a.phrase === 'cement')!;
    expect(cementPomade).toMatchObject({ source: 'SEED', editable: true });
    const edited = await save(h.users.hq, cement(), [
      {
        op: 'edit',
        aliasId: cementPomade.id,
        expectedRevision: cementPomade.revision,
        phrase: 'pomada cement',
        kind: 'NAME',
      },
      { op: 'remove', aliasId: cementName.id, expectedRevision: cementName.revision },
    ]);
    expect(edited.aliases.map((a) => [a.phrase, a.source])).toEqual([['pomada cement', 'HQ']]);
    expect(await seed()).toMatchObject({ upserts: 0, retire: 0 });
    expect((await aliases().list(h.users.hq, cement())).aliases.map((a) => a.phrase)).toEqual([
      'pomada cement',
    ]);
  });

  it('keeps one winner on conflicting edits and never resurrects a removed alias', async () => {
    const [added] = (
      await save(h.users.hq, cement(), [{ op: 'add', phrase: 'betonik', kind: 'NAME' }])
    ).aliases;
    const edit = (phrase: string) =>
      save(h.users.hq, cement(), [
        { op: 'edit', aliasId: added.id, expectedRevision: added.revision, phrase, kind: 'NAME' },
      ]);
    const outcomes = await Promise.allSettled([edit('beton a'), edit('beton b')]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    await expect(edit('beton c')).rejects.toMatchObject({ code: 'STALE_STATE' });
    const [current] = (await aliases().list(h.users.hq, cement())).aliases;
    await save(h.users.hq, cement(), [
      { op: 'remove', aliasId: current.id, expectedRevision: current.revision },
    ]);
    await expect(
      save(h.users.hq, cement(), [
        { op: 'remove', aliasId: current.id, expectedRevision: current.revision },
      ]),
    ).rejects.toMatchObject({ code: 'STALE_STATE' });
    const readded = await save(h.users.hq, cement(), [
      { op: 'add', phrase: current.phrase, kind: 'NAME' },
    ]);
    expect(readded.aliases[0].revision).toBe(current.revision + 2);
  });

  it('reports collisions with other products and keeps document aliases read-only', async () => {
    await seed();
    const result = await save(h.users.hq, cement(), [{ op: 'add', phrase: 'matte', kind: 'TYPE' }]);
    expect(result.collisions).toEqual([
      { phrase: 'matte', productNames: ['Mattifier', 'Pomada Dry Matt', 'Pomada Matowa'] },
    ]);
    await h.addAliases([
      {
        productId: cement(),
        phrase: 'z dokumentu',
        normalized: 'z dokumentu',
        source: 'GENERATED',
        sourceDocumentVersionId: null,
      },
    ]);
    expect(
      (await aliases().list(h.users.hq, cement())).aliases.some((a) => a.phrase === 'z dokumentu'),
    ).toBe(false);
    const documentId = `doc-${randomUUID()}`;
    const versionId = `ver-${randomUUID()}`;
    await h.gql('mutation($d:KnowledgeDocument_Data!){knowledgeDocument_insert(data:$d)}', {
      d: { id: documentId, businessId: h.businessId, documentCode: documentId },
    });
    await h.gql('mutation($v:KnowledgeVersion_Data!){knowledgeVersion_insert(data:$v)}', {
      v: {
        id: versionId,
        documentId,
        businessId: h.businessId,
        versionLabel: 'v1',
        title: 't',
        language: 'pl',
        synthetic: true,
        sourceUrls: [],
        pdfSha256: 'x',
        status: 'READY',
        isActive: true,
        publishedAt: new Date().toISOString(),
      },
    });
    await h.gql(
      'mutation($id:String!,$v:String!){knowledgeDocument_update(id:$id,data:{activeVersionId:$v})}',
      {
        id: documentId,
        v: versionId,
      },
    );
    await h.addAliases([
      {
        productId: cement(),
        phrase: 'z katalogu',
        normalized: 'z katalogu',
        source: 'GENERATED',
        sourceDocumentVersionId: versionId,
      },
    ]);
    const doc = (await aliases().list(h.users.hq, cement())).aliases.find(
      (a) => a.phrase === 'z katalogu',
    )!;
    expect(doc).toMatchObject({ source: 'DOCUMENT', editable: false });
    await expect(
      save(h.users.hq, cement(), [
        { op: 'remove', aliasId: doc.id, expectedRevision: doc.revision },
      ]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('enforces 32 product aliases and denies salon staff and other businesses', async () => {
    const many = Array.from({ length: 32 }, (_, i) => ({
      op: 'add',
      phrase: `fraza ${i}`,
      kind: 'NAME',
    }));
    await save(h.users.hq, cement(), many);
    await expect(
      save(h.users.hq, cement(), [{ op: 'add', phrase: 'jeszcze', kind: 'NAME' }]),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    for (const uid of [h.users.legnicka, h.users.foreign]) {
      await expect(aliases().list(uid, cement())).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        save(uid, cement(), [{ op: 'add', phrase: 'obce', kind: 'NAME' }]),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    }
  });
});
