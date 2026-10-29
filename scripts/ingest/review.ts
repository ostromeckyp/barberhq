import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { OperatorActor } from '../../functions/src/knowledge/models/operator-actor.js';
import type { ReviewInput } from '../../functions/src/knowledge/models/review-input.js';

export type ReviewReceipt = { actor: OperatorActor; review: ReviewInput };

/** The receipt is authored by an operator. This parser never invents approval. */
export async function readReviewReceipt(path: string): Promise<ReviewReceipt> {
  const value = JSON.parse(await readFile(path, 'utf8')) as ReviewReceipt;
  if (
    value?.actor?.kind !== 'operator' ||
    !value.actor.id?.trim() ||
    !value.actor.businessId?.trim() ||
    !value.review?.versionId?.trim() ||
    !/^[a-f0-9]{64}$/.test(value.review.pdfSha256) ||
    !/^[a-f0-9]{64}$/.test(value.review.extractionHash) ||
    !Array.isArray(value.review.reviewedPhysicalPages) ||
    !value.review.reviewedPhysicalPages.every((page) => Number.isSafeInteger(page) && page > 0) ||
    !value.review.approvalText?.trim() ||
    !Number.isFinite(Date.parse(value.review.approvedAt))
  ) {
    throw new Error('Invalid explicit review receipt');
  }
  return value;
}

export async function preserveReviewReceipt(receipt: ReviewReceipt): Promise<string> {
  const safeName = receipt.review.versionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const directory = resolve('data/knowledge/derived/reviews');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${safeName}-${receipt.review.extractionHash}.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 }).catch(
    async (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if ((await readFile(path, 'utf8')) !== `${JSON.stringify(receipt, null, 2)}\n`)
        throw new Error('Existing review receipt differs');
    },
  );
  return path;
}
