import { createHash } from 'node:crypto';
import { z } from 'zod';
import type {
  LegacyCreateDocumentInput,
  CreateDocumentInputV2,
  CreateDocumentRequest,
  DeleteVersionInput,
  ReviewDocumentInput,
  RetryDocumentInput,
} from '../../../shared/contracts/knowledge/index.js';
import { metadataFromLegacy } from '../../../shared/knowledge-metadata.js';
import { KnowledgeError } from './repository.js';

const key = z.uuid();
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const revision = z.int().min(0).max(2_147_483_647);
const versionId = z.string().min(1).max(200);
const url = z
  .url()
  .max(2048)
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  });
const date = z.iso.date().nullable();
const provenanceFields = { sourceUrls: z.array(url).max(10), observedOn: date };
const origin = z.enum(['official', 'public-compilation', 'synthetic']);
const completeProvenance = (
  value: Pick<CreateDocumentInputV2, 'origin' | 'sourceUrls' | 'observedOn'>,
) =>
  value.origin !== 'public-compilation' ||
  (value.sourceUrls.length > 0 && value.observedOn !== null);
const knowledgeProvenanceSchema = z
  .strictObject({ origin, ...provenanceFields })
  .refine(completeProvenance);

export function validateKnowledgeProvenance(
  value: Pick<CreateDocumentInputV2, 'origin' | 'sourceUrls' | 'observedOn'>,
): void {
  parse(knowledgeProvenanceSchema, value);
}

export const createDocumentSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    language: z.enum(['en', 'pl']),
    sourceType: z.enum(['synthetic-procedure', 'public-product-summary']),
    ...provenanceFields,
    sha256: sha,
    idempotencyKey: key,
    documentId: z.string().min(1).max(200).optional(),
    expectedDocumentRevision: revision.optional(),
  })
  .refine((value) => Boolean(value.documentId) === (value.expectedDocumentRevision !== undefined));
const createDocumentV2Schema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    language: z.enum(['en', 'pl']),
    kind: z.enum(['procedure', 'policy', 'product-card', 'product-catalog']),
    origin,
    ...provenanceFields,
    sha256: sha,
    idempotencyKey: key,
    documentId: z.string().min(1).max(200).optional(),
    expectedDocumentRevision: revision.optional(),
  })
  .refine((v) => Boolean(v.documentId) === (v.expectedDocumentRevision !== undefined))
  .refine(completeProvenance);

export function parseCreateDocumentRequest(value: unknown): CreateDocumentRequest {
  return parse(z.union([createDocumentSchema, createDocumentV2Schema]), value);
}
export function normalizeCreateDocument(input: CreateDocumentRequest): CreateDocumentInputV2 {
  if ('sourceType' in input) {
    const { sourceType, ...fields } = input;
    return { ...fields, ...metadataFromLegacy(sourceType) };
  }
  return { ...input };
}
export const deleteVersionSchema = z.strictObject({
  versionId,
  expectedDocumentRevision: revision,
  expectedVersionRevision: z.int().min(1).max(2_147_483_647),
  idempotencyKey: key,
});
export const reviewDocumentSchema = z.strictObject({
  productKnowledgeReviewedHash: sha.optional(),
  versionId,
  extractionHash: sha,
  reviewedPhysicalPages: z.array(z.int().min(1).max(30)).min(1).max(30),
  expectedDocumentRevision: revision,
  idempotencyKey: key,
});
export const retryDocumentSchema = z.strictObject({ versionId, sha256: sha, idempotencyKey: key });

export function parseCreateDocument(value: unknown): LegacyCreateDocumentInput {
  return parse(createDocumentSchema, value);
}
export function parseDeleteVersion(value: unknown): DeleteVersionInput {
  return parse(deleteVersionSchema, value);
}
export function parseReviewDocument(value: unknown): ReviewDocumentInput {
  return parse(reviewDocumentSchema, value);
}
export function parseRetryDocument(value: unknown): RetryDocumentInput {
  return parse(retryDocumentSchema, value);
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new KnowledgeError('VALIDATION_ERROR', 'Invalid document command');
  return result.data;
}

export function knowledgePayloadHash(
  action: 'CREATE' | 'DELETE' | 'REVIEW' | 'RETRY',
  input: CreateDocumentRequest | DeleteVersionInput | ReviewDocumentInput | RetryDocumentInput,
): string {
  let canonical: unknown;
  switch (action) {
    case 'CREATE': {
      const i = input as CreateDocumentRequest;
      canonical = [
        ...('sourceType' in i
          ? [action, i.title, i.language, i.sourceType]
          : ['CREATE_METADATA_V2', i.title, i.language, i.kind, i.origin]),
        i.sourceUrls,
        i.observedOn,
        i.sha256,
        i.documentId ?? null,
        i.expectedDocumentRevision ?? null,
      ];
      break;
    }
    case 'DELETE': {
      const i = input as DeleteVersionInput;
      canonical = [action, i.versionId, i.expectedDocumentRevision, i.expectedVersionRevision];
      break;
    }
    case 'REVIEW': {
      const i = input as ReviewDocumentInput;
      canonical = [
        action,
        i.versionId,
        i.extractionHash,
        i.reviewedPhysicalPages,
        i.expectedDocumentRevision,
      ];
      if (i.productKnowledgeReviewedHash !== undefined)
        canonical = ['REVIEW_PRODUCT_KNOWLEDGE_V1', canonical, i.productKnowledgeReviewedHash];
      break;
    }
    case 'RETRY': {
      const i = input as RetryDocumentInput;
      canonical = [action, i.versionId, i.sha256];
      break;
    }
  }
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
