import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { BusinessSeed } from '../../shared/contracts/business/index.ts';
import type { ManifestEntry } from '../../functions/src/knowledge/pipeline.ts';
import { chunkPages } from '../../functions/src/knowledge/chunk.ts';
import { extractPdf } from '../../functions/src/knowledge/extract.ts';
import { readReviewReceipt, type ReviewReceipt } from '../ingest/review.ts';

export type KnowledgeSeedEntry = ManifestEntry & {
  bytes: Uint8Array;
  receipt: ReviewReceipt | null;
};
export type KnowledgeSeed = { entries: KnowledgeSeedEntry[] };

/** The repo knowledge baseline: manifest entries with their PDF bytes and owner approval receipts. */
export async function readKnowledgeSeed(
  opts: { manifest?: string; reviews?: string } = {},
): Promise<KnowledgeSeed> {
  const manifest = JSON.parse(
    await readFile(resolve(opts.manifest ?? 'data/knowledge/manifest.json'), 'utf8'),
  ) as ManifestEntry[];
  const reviews = opts.reviews ?? 'data/knowledge/reviews';
  const entries = await Promise.all(
    manifest.map(async (entry) => {
      const receipt = await readReviewReceipt(
        resolve(reviews, `${entry.documentId}-${entry.version}.approval.json`),
      ).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      return { ...entry, bytes: new Uint8Array(await readFile(resolve(entry.inputPdf))), receipt };
    }),
  );
  return { entries };
}

/** Every problem that must stop a reset before anything is deleted; empty means ready. */
export function validateKnowledgeSeed(seed: KnowledgeSeed, businessSeed: BusinessSeed): string[] {
  const problems: string[] = [];
  const demoIds = new Set(businessSeed.products.map((p) => p.demoId));
  const linked = new Set<string>();
  const bound = new Set<string>();
  for (const e of seed.entries) {
    const at = `${e.documentId} ${e.version}`;
    if (createHash('sha256').update(e.bytes).digest('hex') !== e.sha256)
      problems.push(`${at}: PDF_HASH_MISMATCH`);
    if (!e.receipt) problems.push(`${at}: RECEIPT_MISSING`);
    else if (
      e.receipt.review.pdfSha256 !== e.sha256 ||
      e.receipt.review.versionId !== `${e.businessKey}:${e.documentId}:${e.version}` ||
      e.receipt.actor.businessId !== e.businessKey
    )
      problems.push(`${at}: RECEIPT_MISMATCH`);
    const card = e.kind === 'product-card';
    if (
      card !== !!e.productDemoId ||
      (card && (!demoIds.has(e.productDemoId!) || linked.has(e.productDemoId!)))
    )
      problems.push(`${at}: PRODUCT_LINK_INVALID`);
    if (e.productDemoId) linked.add(e.productDemoId);
    const kind = e.deliveryProblemKind;
    if (
      kind &&
      (e.kind !== 'procedure' || e.publicationStatus !== 'demo-current' || bound.has(kind))
    )
      problems.push(`${at}: BINDING_INVALID`);
    if (kind) bound.add(kind);
  }
  return problems;
}

/**
 * Full preflight, run before any wipe: seed validation plus a fresh local extraction of every
 * entry, which must still match the owner-approved receipt. Also counts chunks to embed.
 */
export async function checkKnowledgeSeed(
  seed: KnowledgeSeed,
  businessSeed: BusinessSeed,
): Promise<{ problems: string[]; embeddingTexts: number }> {
  const problems = validateKnowledgeSeed(seed, businessSeed);
  let embeddingTexts = 0;
  for (const e of seed.entries) {
    const extraction = await extractPdf(e.bytes);
    if (e.receipt && extraction.extractionHash !== e.receipt.review.extractionHash)
      problems.push(`${e.documentId} ${e.version}: EXTRACTION_CHANGED`);
    if (e.publicationStatus === 'demo-current') embeddingTexts += chunkPages(extraction).length;
  }
  return { problems, embeddingTexts };
}
