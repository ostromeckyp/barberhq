import type {
  KnowledgeReview,
  ReviewDocumentInput,
} from '../../../../../../shared/contracts/knowledge/index';
import type { SessionState } from '../../../../../../shared/contracts/business/index';

/** A new publish command for every checked page of this review, frozen for a safe retry. */
export function reviewPublishInput(
  review: KnowledgeReview,
  checkedPages: ReadonlySet<number>,
  productKnowledgeReviewedHash: string | null | undefined,
): ReviewDocumentInput {
  return Object.freeze({
    versionId: review.version.versionId,
    extractionHash: review.extractionHash,
    reviewedPhysicalPages: [...checkedPages].sort((a, b) => a - b),
    expectedDocumentRevision: review.version.documentRevision,
    idempotencyKey: crypto.randomUUID(),
    ...((review.version.kind === 'product-card' || review.version.kind === 'product-catalog') &&
    productKnowledgeReviewedHash
      ? { productKnowledgeReviewedHash }
      : {}),
  });
}
export function reviewErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}
export function loadErrorMessage(error: unknown): string {
  const code = reviewErrorCode(error);
  if (code === 'FORBIDDEN') return 'This document review is unavailable in the selected workspace.';
  if (code === 'UNAUTHENTICATED') return 'Sign in again to continue this review.';
  return 'The review and original PDF could not be loaded. Retry to refresh the current version.';
}

/** Review identity and storage owner for the signed-in member and the routed version. */
export function reviewScope(state: SessionState, versionId: string | null | undefined) {
  const owner =
    state.status === 'READY'
      ? `${state.membership.userId}:${state.membership.businessId}`
      : state.status;
  const identity = state.status === 'READY' && versionId ? `${owner}:${versionId}` : state.status;
  return { identity, owner };
}
/** Session storage for a frozen publish command, so a retry replays the same request. */
export function reviewStorageKey(owner: string, versionId: string): string {
  return `barberhq:document-review:${owner}:${versionId}`;
}
/** Whether a frozen command still targets this review's version and extraction. */
export function frozenMatches(frozen: ReviewDocumentInput, review: KnowledgeReview): boolean {
  return (
    frozen.versionId === review.version.versionId && frozen.extractionHash === review.extractionHash
  );
}
export function readFrozen(key: string): ReviewDocumentInput | undefined {
  if (!key) return undefined;
  try {
    const value = sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as ReviewDocumentInput) : undefined;
  } catch {
    return undefined;
  }
}
export function persistFrozen(key: string, frozen: () => ReviewDocumentInput | undefined): void {
  try {
    const value = frozen();
    if (key && value) sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* In-memory replay still preserves this view's command. */
  }
}
export function removeFrozen(key: string): void {
  try {
    if (key) sessionStorage.removeItem(key);
  } catch {
    /* Storage may be disabled by the browser. */
  }
}
export function removeOwnerStorage(owner: string): void {
  try {
    const prefix = `barberhq:document-review:${owner}:`;
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    /* Storage may be disabled by the browser. */
  }
}
