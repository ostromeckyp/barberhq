import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, it, expect } from 'vitest';
import * as sql from '@barberhq/server';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { ProductKnowledgeCommands } from '../../functions/src/knowledge/product-knowledge-commands.ts';
import type { SaveKnowledgeProductReviewInput } from '../../shared/contracts/product-knowledge/index.ts';
let h: Awaited<ReturnType<typeof createKnowledgeHarness>>,
  commands: ProductKnowledgeCommands,
  versionId: string,
  hq: string,
  salon: string,
  foreign: string,
  input: SaveKnowledgeProductReviewInput;
let users: string[] = [];
beforeEach(async () => {
  h = await createKnowledgeHarness();
  users = [];
  hq = randomUUID();
  salon = randomUUID();
  foreign = randomUUID();
  for (const [uid, businessId, role] of [
    [hq, h.id, 'HQ'],
    [salon, h.id, 'SALON'],
    [foreign, h.foreignId, 'HQ'],
  ]) {
    users.push(uid);
    await sql.upsertMembership(h.dc, { uid, businessId, role: role as sql.MemberRole });
  }
  for (const id of ['a', 'b'])
    await sql.upsertProduct(h.dc, {
      id: `${h.id}:${id}`,
      businessId: h.id,
      demoId: id,
      name: `Product ${id}`,
      brand: 'X',
      category: 'X',
      summaryEn: 'Facts',
      scentPl: null,
      sourceCode: id === 'a' ? '123' : '456',
      netContentMl: 1,
      retailPriceGrosz: 1,
      sourceUrl: 'https://example.com',
      observedOn: '2026-10-27',
    });
  const p = h.pipeline(h.id);
  versionId = await p.stageVersion(
    { ...h.entry, kind: 'product-catalog', origin: 'synthetic', sourceType: undefined } as never,
    h.bytes,
  );
  await p.extractVersion(versionId);
  const v = (await h.repo.version(versionId))!;
  commands = new ProductKnowledgeCommands(h.repo);
  input = {
    versionId,
    extractionHash: v.extractionHash!,
    expectedReviewRevision: 0,
    idempotencyKey: randomUUID(),
    links: [
      {
        passage: { chunkId: v.chunks[0].id, start: 0, end: 5 },
        productId: `${h.id}:a`,
        confirmed: true,
      },
    ],
    profiles: [
      {
        productId: `${h.id}:a`,
        type: 'type X',
        aliases: [{ phrase: 'Alpha', kind: 'name', lang: 'pl', decision: 'accepted' }],
      },
    ],
    acknowledgedUnlinkedPassages: [],
    emptyKnowledgeAcknowledged: false,
  };
});
afterEach(async () => {
  if (!h) return;
  for (const uid of users)
    await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
      variables: { uid },
    });
  await h.dispose();
});
it('stores only proposed version-bound aliases, preserves source and replays one exact result', async () => {
  const saved = await commands.save(hq, input);
  expect(saved.revision).toBe(1);
  expect(saved.profiles[0].aliases[0]).toMatchObject({
    phrase: 'Alpha',
    source: 'hq',
    decision: 'accepted',
  });
  expect(saved.unlinkedPassages.length).toBeGreaterThan(0);
  expect(await commands.save(hq, input)).toEqual(saved);
  await expect(
    commands.save(hq, { ...input, emptyKnowledgeAcknowledged: true }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  const data = await h.dc.executeGraphql<
    { productAliases: { status: string; reviewedAt: string; sourceDocumentVersionId: string }[] },
    { id: string }
  >(
    'query($id:String!){productAliases(where:{sourceDocumentVersionId:{eq:$id}}){status reviewedAt sourceDocumentVersionId}}',
    { variables: { id: versionId } },
  );
  expect(data.data.productAliases).toEqual([
    { status: 'PROPOSED', reviewedAt: expect.any(String), sourceDocumentVersionId: versionId },
  ]);
});
it('denies salon, foreign and removed HQ on read, write and replay', async () => {
  for (const uid of [salon, foreign]) {
    await expect(commands.read(uid, versionId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(commands.save(uid, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }
  await commands.save(hq, input);
  await h.dc.executeGraphql('mutation($uid:String!){membership_delete(key:{uid:$uid})}', {
    variables: { uid: hq },
  });
  users = users.filter((u) => u !== hq);
  await expect(commands.save(hq, input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
});
it('rejects forged fields, foreign products, foreign chunks and outdated extraction', async () => {
  for (const raw of [
    { ...input, businessId: h.foreignId },
    {
      ...input,
      profiles: [
        {
          ...input.profiles[0],
          aliases: [{ ...input.profiles[0].aliases[0], normalized: 'forged' }],
        },
      ],
    },
    { ...input, links: [{ ...input.links[0], productId: 'foreign' }] },
    {
      ...input,
      links: [{ ...input.links[0], passage: { ...input.links[0].passage, chunkId: 'foreign' } }],
    },
  ])
    await expect(commands.save(hq, raw as never)).rejects.toMatchObject({
      code: expect.stringMatching(/VALIDATION_ERROR|FORBIDDEN/),
    });
  await expect(
    commands.save(hq, { ...input, extractionHash: 'b'.repeat(64) }),
  ).rejects.toMatchObject({ code: 'STALE_STATE' });
});
it('has one CAS winner and blocks product changes during pending publication', async () => {
  const results = await Promise.allSettled([
    commands.save(hq, input),
    commands.save(hq, { ...input, idempotencyKey: randomUUID() }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const current = await commands.read(hq, versionId);
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{pendingStage:PUBLISH})}',
    { variables: { id: versionId } },
  );
  await expect(
    commands.save(hq, {
      ...input,
      expectedReviewRevision: current.revision,
      idempotencyKey: randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'STALE_STATE' });
});
it('narrows two products in one chunk and refuses overlapping or multi-product cards', async () => {
  const chunk = (await h.repo.version(versionId))!.chunks[0];
  const second = {
    passage: { chunkId: chunk.id, start: 6, end: Math.min(chunk.text.length, 12) },
    productId: `${h.id}:b`,
    confirmed: true,
  };
  const edit = { ...input, links: [...input.links, second] };
  expect((await commands.save(hq, edit)).links.map((l) => l.productId).sort()).toEqual([
    `${h.id}:a`,
    `${h.id}:b`,
  ]);
  await h.dc.executeGraphql(
    'mutation($id:String!){knowledgeVersion_update(id:$id,data:{kind:PRODUCT_CARD})}',
    { variables: { id: versionId } },
  );
  await expect(
    commands.save(hq, { ...edit, expectedReviewRevision: 1, idempotencyKey: randomUUID() }),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
});
it('bumps catalog revision on the named product writer and rejects a stale draft save', async () => {
  const before = await commands.read(hq, versionId);
  await sql.upsertProduct(h.dc, {
    id: `${h.id}:a`,
    businessId: h.id,
    demoId: 'a',
    name: 'Changed',
    brand: 'X',
    category: 'X',
    summaryEn: 'Facts',
    sourceCode: '123',
    netContentMl: 1,
    retailPriceGrosz: 1,
    sourceUrl: 'https://example.com',
    observedOn: '2026-10-27',
  });
  expect((await commands.read(hq, versionId)).catalogRevision).toBe(before.catalogRevision + 1);
});
it('edits existing identities atomically and retains replay of an earlier snapshot', async () => {
  const first = await commands.save(hq, input);
  const next = await commands.save(hq, {
    ...input,
    expectedReviewRevision: 1,
    idempotencyKey: randomUUID(),
    links: first.links.map(({ id, passage, productId, confirmed }) => ({
      id,
      passage,
      productId,
      confirmed,
    })),
    profiles: first.profiles.map((p) => ({
      ...p,
      aliases: p.aliases.map((a) => ({
        id: a.id,
        phrase: 'Beta',
        kind: a.kind,
        lang: a.lang,
        decision: 'rejected',
      })),
    })),
  });
  expect(next.revision).toBe(2);
  expect(next.profiles[0].aliases).toEqual([
    expect.objectContaining({
      id: first.profiles[0].aliases[0].id,
      phrase: 'Beta',
      decision: 'rejected',
      source: 'hq',
    }),
  ]);
  expect(await commands.save(hq, input)).toEqual(first);
});
it('enforces the browser query auth policy and does not expose draft aliases to SALON', async () => {
  const { getDataConnect } = await import('firebase-admin/data-connect');
  const { getKnowledgeProductReview } = await import('@barberhq/browser-admin');
  const { initializeApp, deleteApp } = await import('firebase-admin/app');
  const app = initializeApp({ projectId: 'demo-barberhq' }, `product-browser-${randomUUID()}`);
  const browser = getDataConnect(
    { connector: 'browser', serviceId: 'barberhq', location: 'europe-west1' },
    app,
  );
  try {
    await commands.save(hq, input);
    for (const uid of [salon, foreign])
      await expect(
        getKnowledgeProductReview(
          browser,
          { versionId },
          { impersonate: { authClaims: { sub: uid, uid } } },
        ),
      ).rejects.toThrow();
    const result = await getKnowledgeProductReview(
      browser,
      { versionId },
      { impersonate: { authClaims: { sub: hq, uid: hq } } },
    );
    expect(result.data.membership?.business.versions[0].aliases).toHaveLength(1);
  } finally {
    await deleteApp(app);
  }
});
it('rejects writes after extraction replacement, publication or revocation', async () => {
  for (const data of [
    { extractionHash: 'c'.repeat(64) },
    { publishedAt: new Date().toISOString() },
    { revokedAt: new Date().toISOString() },
  ]) {
    await h.dc.executeGraphql(
      'mutation($id:String!,$data:KnowledgeVersion_Data!){knowledgeVersion_update(id:$id,data:$data)}',
      { variables: { id: versionId, data } },
    );
    await expect(commands.save(hq, input)).rejects.toMatchObject({ code: 'STALE_STATE' });
    await h.dc.executeGraphql(
      'mutation($id:String!,$hash:String!){knowledgeVersion_update(id:$id,data:{extractionHash:$hash,publishedAt:null,revokedAt:null})}',
      { variables: { id: versionId, hash: input.extractionHash } },
    );
  }
});
