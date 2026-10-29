import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKnowledgeHarness } from '../support/knowledge.ts';
import { seedHqAndProduct } from '../support/product-card-fixture.ts';
import type { ManifestEntry } from '../../functions/src/knowledge/pipeline.ts';

type H = Awaited<ReturnType<typeof createKnowledgeHarness>>;
const operator = (businessId: string) =>
  ({ kind: 'operator', id: 'owner@example.invalid', businessId }) as const;

describe('Feature: operator-reviewed product documents (demo reset)', () => {
  let h: H, productId: string;
  beforeEach(async () => {
    h = await createKnowledgeHarness();
    ({ productId } = await seedHqAndProduct(h));
  });
  afterEach(async () => {
    await h?.dispose();
  });
  const entry = (kind: 'product-card' | 'product-catalog'): ManifestEntry => ({
    ...h.entry,
    documentId: kind === 'product-card' ? 'CARD-A' : 'CAT-X',
    version: 'v1',
    kind,
    origin: 'public-compilation',
    sourceUrls: ['https://example.com'],
    observedOn: '2026-10-27',
  });
  async function reviewed(kind: 'product-card' | 'product-catalog') {
    const pipeline = h.pipeline(h.id);
    const versionId = await pipeline.stageVersion(entry(kind), h.bytes);
    await pipeline.extractVersion(versionId);
    const state = (await h.repo.version(versionId))!;
    await pipeline.recordReview(
      {
        versionId,
        pdfSha256: state.pdfSha256,
        extractionHash: state.extractionHash!,
        reviewedPhysicalPages: state.pages.map((p) => p.physicalPage),
        approvalText: 'Owner approved',
        approvedAt: '2026-10-29',
      },
      operator(h.id),
    );
    return { pipeline, versionId };
  }
  const read = async (versionId: string) =>
    (
      await h.dc.executeGraphql<
        {
          knowledgeProductLinks: { productId: string | null; confirmed: boolean }[];
          productAliases: { id: string }[];
          business: { productKnowledgeRevision: number };
        },
        { v: string; b: string }
      >(
        'query($v:String!,$b:String!){knowledgeProductLinks(where:{versionId:{eq:$v}}){productId confirmed} productAliases(where:{sourceDocumentVersionId:{eq:$v}}){id} business(id:$b){productKnowledgeRevision}}',
        { variables: { v: versionId, b: h.id } },
      )
    ).data;

  it('operator-reviewed card publishes with its product link', async () => {
    const { pipeline, versionId } = await reviewed('product-card');
    const before = (await read(versionId)).business.productKnowledgeRevision;
    const { reviewedHash } = await pipeline.recordOperatorProductReview({ versionId, productId });
    expect(reviewedHash).toMatch(/^[a-f0-9]{64}$/);
    await pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 });
    expect((await h.repo.version(versionId))?.isActive).toBe(true);
    const after = await read(versionId);
    expect(after.knowledgeProductLinks).toEqual([{ productId, confirmed: true }]);
    expect(after.productAliases).toEqual([]);
    expect(after.business.productKnowledgeRevision).toBe(before + 1);
  });

  it('operator-reviewed catalog publishes with empty knowledge acknowledged', async () => {
    const { pipeline, versionId } = await reviewed('product-catalog');
    await pipeline.recordOperatorProductReview({ versionId, productId: null });
    await pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 });
    expect((await h.repo.version(versionId))?.isActive).toBe(true);
    expect((await read(versionId)).knowledgeProductLinks).toEqual([]);
  });

  it('operator publish of a card without product review is refused', async () => {
    const { pipeline, versionId } = await reviewed('product-card');
    await expect(
      pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 }),
    ).rejects.toThrow();
    expect((await h.repo.version(versionId))?.publishedAt).toBeFalsy();
  });

  it('operator product review is refused for a card without a product and after publish', async () => {
    const { pipeline, versionId } = await reviewed('product-card');
    await expect(
      pipeline.recordOperatorProductReview({ versionId, productId: null }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await pipeline.recordOperatorProductReview({ versionId, productId });
    await pipeline.publishVersion({ versionId, expectedDocumentRevision: 0 });
    await expect(
      pipeline.recordOperatorProductReview({ versionId, productId }),
    ).rejects.toMatchObject({ code: 'STALE_STATE' });
  });
});
