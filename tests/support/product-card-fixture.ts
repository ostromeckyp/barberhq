import { randomUUID } from 'node:crypto';
import * as sql from '@barberhq/server';
import type { createKnowledgeHarness } from './knowledge.ts';
import { createAiAdmission } from '../../functions/src/ai/admission.ts';
import { createSqlAiRepository } from '../../functions/src/ai/repository.ts';
import { consumeModelTurn } from '../../functions/src/ai/budget.ts';
import { DocumentCommandService } from '../../functions/src/knowledge/document-commands.ts';
import { ProductKnowledgeCommands } from '../../functions/src/product-knowledge/commands.ts';
import { ProductKnowledgeGeneration } from '../../functions/src/product-knowledge/generation.ts';
import { ReviewPublishService } from '../../functions/src/knowledge/review-publish.ts';
import { processKnowledge } from '../../functions/src/knowledge/worker.ts';
import type { KnowledgeJob } from '../../functions/src/knowledge/queue.ts';
import { createProductCardService } from '../../functions/src/products/card-attachment.ts';

type H = Awaited<ReturnType<typeof createKnowledgeHarness>>;

/** HQ, an HQ location and one product in the harness business. */
export async function seedHqAndProduct(h: H, demoId = 'a') {
  const hq = randomUUID();
  await sql.upsertMembership(h.dc, { uid: hq, businessId: h.id, role: sql.MemberRole.HQ });
  await sql.upsertLocation(h.dc, {
    id: `${h.id}:hq`,
    businessId: h.id,
    key: 'hq',
    name: 'HQ',
    kind: sql.LocationKind.HQ,
  });
  const productId = `${h.id}:${demoId}`;
  await sql.upsertProduct(h.dc, {
    id: productId,
    businessId: h.id,
    demoId,
    name: `Product ${demoId}`,
    brand: 'X',
    category: 'type X',
    summaryEn: 'Facts',
    sourceCode: `code-${demoId}`,
    netContentMl: 1,
    retailPriceGrosz: 1,
    sourceUrl: 'https://example.com',
    observedOn: '2026-10-27',
  });
  return { hq, productId };
}

/** Attaches and publishes a card exactly as HQ does from the product screen. */
export async function publishHqCard(h: H, hq: string, productId: string): Promise<string> {
  const jobs: KnowledgeJob[] = [];
  const products = new ProductKnowledgeCommands(h.repo);
  const cards = createProductCardService({
    dc: h.dc,
    repo: h.repo,
    documents: new DocumentCommandService(h.repo),
    products,
    generation: new ProductKnowledgeGeneration(
      products,
      createAiAdmission(createSqlAiRepository(h.dc)),
      async (budget, _prompt, kind) => {
        consumeModelTurn(budget);
        if (kind === 'link') return { productIds: [] };
        return { type: 'type Y', aliases: [{ phrase: 'akaa', kind: 'phonetic', lang: 'pl' }] };
      },
    ),
    review: new ReviewPublishService({
      repo: h.repo,
      pipeline: h.pipeline(h.id),
      enqueue: async (job) => void jobs.push(job),
    }),
  });
  const sha256 = h.hash(h.bytes);
  const { versionId } = await cards.attach(hq, { productId, sha256, idempotencyKey: randomUUID() });
  const label = versionId.slice(versionId.lastIndexOf(':') + 1);
  const code = versionId.slice(versionId.indexOf(':') + 1, versionId.lastIndexOf(':'));
  const objectPath = `knowledge/${h.id}/${code}/${label}/${sha256}.pdf`;
  await h.repo.bucket
    .file(objectPath)
    .save(Buffer.from(h.bytes), { metadata: { metadata: { sha256 } } } as never);
  await sql.bindKnowledgeOriginal(h.dc, {
    uid: hq,
    businessId: h.id,
    versionId,
    pdfSha256: sha256,
    bucket: 'test-knowledge-bucket',
    objectPath,
    objectGeneration: '1',
    byteSize: h.bytes.length,
    pageCount: 1,
  });
  await h.pipeline(h.id).extractVersion(versionId);
  await cards.process(hq, { productId, versionId, idempotencyKey: randomUUID() });
  await processKnowledge(jobs.at(-1)!, { repo: h.repo, pipeline: h.pipeline(h.id) });
  return versionId;
}
