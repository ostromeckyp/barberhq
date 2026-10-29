import type * as sql from '@barberhq/server';
import type { ReviewDocumentInput } from '../../../shared/contracts/knowledge/index.js';
import { KnowledgeError } from './repository.js';
import type { VersionState } from './models/version-state.js';

type Context = sql.KnowledgeCommandContextData;

export function pagesAreExact(
  version: VersionState,
  input: ReviewDocumentInput,
  requireReviewed = false,
): boolean {
  const expected = Array.from({ length: version.pageCount ?? 0 }, (_, index) => index + 1);
  const actual = [...input.reviewedPhysicalPages].sort((a, b) => a - b);
  const extractedPages = version.pages.map((page) => page.physicalPage).sort((a, b) => a - b);
  return (
    version.extractionHash === input.extractionHash &&
    actual.length === input.reviewedPhysicalPages.length &&
    JSON.stringify(actual) === JSON.stringify(expected) &&
    version.pages.length === expected.length &&
    JSON.stringify(extractedPages) === JSON.stringify(expected) &&
    version.pages.every(
      (page) => page.quality === 'COMPLETE' && (!requireReviewed || page.reviewed),
    )
  );
}

export function sameOperation(
  context: Context,
  uid: string,
  key: string,
  hash: string,
  versionId: string,
) {
  const operation = context.membership?.business.operations[0];
  if (
    operation &&
    (operation.actorUid !== uid ||
      operation.idempotencyKey !== key ||
      operation.action !== 'REVIEW' ||
      operation.payloadHash !== hash ||
      operation.versionId !== versionId)
  )
    throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
  return operation;
}
