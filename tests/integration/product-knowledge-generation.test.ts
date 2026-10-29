import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { createProductKnowledgeHarness } from '../support/product-knowledge.ts';
import { createAiAdmission } from '../../functions/src/ai/admission.ts';
import { createSqlAiRepository } from '../../functions/src/ai/repository.ts';
import {
  ProductKnowledgeGeneration,
  type KnowledgeGenerationProvider,
} from '../../functions/src/knowledge/product-knowledge-generation.ts';
import * as sql from '@barberhq/server';
let h: Awaited<ReturnType<typeof createProductKnowledgeHarness>>;
let provider: KnowledgeGenerationProvider;
let calls: number;
let prompts: string[];
let admission: ReturnType<typeof createAiAdmission>;
beforeEach(async () => {
  h = await createProductKnowledgeHarness();
  calls = 0;
  prompts = [];
  provider = async (_budget, prompt, kind) => {
    calls++;
    prompts.push(prompt);
    return kind === 'link'
      ? { productIds: [h.productId] }
      : { type: 'type X', aliases: [{ phrase: 'Alpha', kind: 'name', lang: 'pl' }] };
  };
  admission = createAiAdmission(createSqlAiRepository(h.dc));
});
afterEach(async () => {
  await h?.dispose();
});
const command = () => ({
  versionId: h.versionId,
  extractionHash: h.input.extractionHash,
  expectedReviewRevision: 1,
  productId: h.productId,
  idempotencyKey: randomUUID(),
});
const service = () => new ProductKnowledgeGeneration(h.commands, admission, provider);
it('makes one generation call for a confirmed product, stores proposals and replays without quota', async () => {
  await h.commands.save(h.hq, h.input);
  const input = command();
  const result = await service().generateAliases(h.hq, input);
  expect(calls).toBe(1);
  expect(result.profiles[0]).toMatchObject({
    type: 'type X',
    aliases: [{ phrase: 'Alpha', source: 'generated', decision: 'pending' }],
  });
  expect(await service().generateAliases(h.hq, input)).toEqual(result);
  expect(calls).toBe(1);
  expect(prompts[0]).toContain('untrusted');
});
it('rejects unconfirmed products before using the provider', async () => {
  await expect(
    service().generateAliases(h.hq, { ...command(), expectedReviewRevision: 0 }),
  ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  expect(calls).toBe(0);
});
it('proposes a name link without confirming it and code links need no provider', async () => {
  const result = await service().suggestLink(h.hq, {
    versionId: h.versionId,
    extractionHash: h.input.extractionHash,
    expectedReviewRevision: 0,
    passage: h.passage,
    idempotencyKey: randomUUID(),
  });
  expect(result.links[0]).toMatchObject({
    confirmed: false,
    productId: null,
    candidateProductIds: [h.productId],
    method: 'model',
  });
  expect(calls).toBe(1);
  const chunk = (await h.repo.version(h.versionId))!.chunks[0];
  const match = chunk.text.match(/[A-Za-z]{3,}/)!;
  expect(match).not.toBeNull();
  const at = match.index!;
  await h.dc.executeGraphql(
    'mutation($id:String!,$code:String!){product_update(id:$id,data:{sourceCode:$code})}',
    { variables: { id: h.productId, code: match[0] } },
  );
  await service().suggestLink(h.hq, {
    versionId: h.versionId,
    extractionHash: h.input.extractionHash,
    expectedReviewRevision: 1,
    passage: { chunkId: chunk.id, start: at, end: at + match[0].length },
    idempotencyKey: randomUUID(),
  });
  expect(calls).toBe(1);
});
it.each(['catalog', 'link', 'extraction', 'membership'])(
  'fences provider output after a %s edit',
  async (change) => {
    await h.commands.save(h.hq, h.input);
    provider = async () => {
      calls++;
      if (change === 'catalog')
        await sql.upsertProduct(h.dc, {
          id: h.productId,
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
      if (change === 'link')
        await h.commands.save(h.hq, {
          ...h.input,
          expectedReviewRevision: 1,
          idempotencyKey: randomUUID(),
          links: [],
          profiles: [],
        });
      if (change === 'extraction')
        await h.dc.executeGraphql(
          'mutation($id:String!){knowledgeVersion_update(id:$id,data:{extractionHash:"changed"})}',
          { variables: { id: h.versionId } },
        );
      if (change === 'membership')
        await h.dc.executeGraphql(
          'mutation($uid:String!){membership_update(key:{uid:$uid},data:{role:SALON})}',
          { variables: { uid: h.hq } },
        );
      return { type: null, aliases: [{ phrase: 'Alpha', kind: 'name', lang: 'pl' }] };
    };
    await expect(service().generateAliases(h.hq, command())).rejects.toMatchObject({
      code: expect.stringMatching(/STALE_STATE|FORBIDDEN/),
    });
    const aliases = await h.dc.executeGraphql<{ productAliases: { id: string }[] }, { id: string }>(
      'query($id:String!){productAliases(where:{sourceDocumentVersionId:{eq:$id}}){id}}',
      { variables: { id: h.versionId } },
    );
    expect(aliases.data.productAliases).toEqual([]);
  },
);
it('preserves manually reviewed aliases and type while appending generated proposals', async () => {
  await h.commands.save(h.hq, {
    ...h.input,
    profiles: [
      {
        productId: h.productId,
        type: 'manual type',
        aliases: [{ phrase: 'Manual', kind: 'name', lang: 'pl', decision: 'accepted' }],
      },
    ],
  });
  const result = await service().generateAliases(h.hq, command());
  expect(result.profiles[0].type).toBe('manual type');
  expect(result.profiles[0].aliases).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ phrase: 'Manual', source: 'hq', decision: 'accepted' }),
      expect.objectContaining({ phrase: 'Alpha', source: 'generated', decision: 'pending' }),
    ]),
  );
});
it('claims before provider use and blocks concurrent requests with the same key', async () => {
  await h.commands.save(h.hq, h.input);
  let release: () => void = () => {};
  const wait = new Promise<void>((r) => (release = r));
  let entered: () => void = () => {};
  const started = new Promise<void>((r) => (entered = r));
  provider = async () => {
    calls++;
    entered();
    await wait;
    return { type: null, aliases: [] };
  };
  const input = command();
  const first = service().generateAliases(h.hq, input);
  await started;
  await expect(service().generateAliases(h.hq, input)).rejects.toMatchObject({
    code: 'IN_PROGRESS',
  });
  release();
  await first;
  expect(calls).toBe(1);
});
it('rejects malformed provider authority and keeps failure explicitly retryable', async () => {
  await h.commands.save(h.hq, h.input);
  provider = async () => ({ type: null, aliases: [], productId: 'forged', status: 'active' });
  const input = command();
  await expect(service().generateAliases(h.hq, input)).rejects.toMatchObject({
    code: 'VALIDATION_ERROR',
  });
  provider = async () => ({ type: null, aliases: [] });
  expect((await service().generateAliases(h.hq, input)).revision).toBe(2);
});
it('fences an expired attempt from a successor and observes its late provider result', async () => {
  await h.commands.save(h.hq, h.input);
  let release: (value: unknown) => void = () => {};
  let entered: () => void = () => {};
  const started = new Promise<void>((r) => (entered = r));
  provider = async () => {
    calls++;
    entered();
    return new Promise((r) => (release = r));
  };
  const input = command();
  const first = service().generateAliases(h.hq, input);
  const observed = expect(first).rejects.toMatchObject({ code: 'STALE_STATE' });
  await started;
  await h.dc.executeGraphql(
    'mutation($key:String!){productKnowledgeOperation_updateMany(where:{idempotencyKey:{eq:$key}},data:{leaseExpiresAt:"2020-01-01T00:00:00Z"})}',
    { variables: { key: input.idempotencyKey } },
  );
  provider = async () => {
    calls++;
    return { type: null, aliases: [{ phrase: 'Successor', kind: 'name', lang: 'pl' }] };
  };
  const result = await service().generateAliases(h.hq, input);
  release({ type: null, aliases: [{ phrase: 'Late', kind: 'name', lang: 'pl' }] });
  await observed;
  expect(result.profiles[0].aliases.map((a) => a.phrase)).toEqual(['Successor']);
  expect(
    (await h.commands.read(h.hq, h.versionId)).profiles[0].aliases.map((a) => a.phrase),
  ).toEqual(['Successor']);
});
it('does not persist after the original deadline and makes no automatic retry on provider 429', async () => {
  await h.commands.save(h.hq, h.input);
  let now = Date.now();
  provider = async () => {
    calls++;
    now += 25001;
    return { type: null, aliases: [] };
  };
  await expect(
    new ProductKnowledgeGeneration(h.commands, admission, provider, () => now).generateAliases(
      h.hq,
      command(),
    ),
  ).rejects.toMatchObject({ code: 'TIMEOUT' });
  expect((await h.commands.read(h.hq, h.versionId)).revision).toBe(1);
  provider = async () => {
    calls++;
    throw { status: 429 };
  };
  await expect(service().generateAliases(h.hq, command())).rejects.toBeDefined();
  expect(calls).toBe(2);
  expect((await h.commands.read(h.hq, h.versionId)).revision).toBe(1);
});
it('uses the existing ten-admission SQL window across endpoints', async () => {
  await h.commands.save(h.hq, h.input);
  const actor = await admission.resolveActor(h.hq);
  for (let i = 0; i < 10; i++)
    await admission.admitAiCall(actor, i % 2 ? 'procedure' : 'replenishment', 'test', new Date());
  await expect(service().generateAliases(h.hq, command())).rejects.toMatchObject({
    code: 'RATE_LIMITED',
  });
  expect(calls).toBe(0);
  expect((await h.commands.read(h.hq, h.versionId)).revision).toBe(1);
});
it('preserves code provenance when HQ confirms a suggested product and resets it after a passage change', async () => {
  const chunk = (await h.repo.version(h.versionId))!.chunks[0];
  const match = chunk.text.match(/[A-Za-z]{3,}/)!;
  await h.dc.executeGraphql(
    'mutation($id:String!,$code:String!){product_update(id:$id,data:{sourceCode:$code})}',
    { variables: { id: h.productId, code: match[0] } },
  );
  const suggested = await service().suggestLink(h.hq, {
    versionId: h.versionId,
    extractionHash: h.input.extractionHash,
    expectedReviewRevision: 0,
    passage: { chunkId: chunk.id, start: match.index!, end: match.index! + match[0].length },
    idempotencyKey: randomUUID(),
  });
  const confirmed = await h.commands.save(h.hq, {
    ...h.input,
    expectedReviewRevision: suggested.revision,
    idempotencyKey: randomUUID(),
    links: suggested.links.map((l) => ({
      id: l.id,
      passage: l.passage,
      productId: h.productId,
      confirmed: true,
    })),
  });
  expect(confirmed.links[0].method).toBe('code');
  const changed = await h.commands.save(h.hq, {
    ...h.input,
    expectedReviewRevision: confirmed.revision,
    idempotencyKey: randomUUID(),
    links: confirmed.links.map((l) => ({
      id: l.id,
      passage: { ...l.passage, end: l.passage.end + 1 },
      productId: h.productId,
      confirmed: true,
    })),
  });
  expect(changed.links[0].method).toBe('hq');
});
