import { KnowledgeError } from '../knowledge/repository.js';
import type { VersionState } from '../knowledge/models/version-state.js';
import { ProductKnowledgeRepository } from './repository.js';
import type { DataConnect } from 'firebase-admin/data-connect';
import { metadataFromStorage } from '../../../shared/knowledge-metadata.js';
/** Fresh requests must include the accepted identity. Only durable old receipts can recover PDF-only. */
export async function validateProductPublication(
  dc: DataConnect,
  uid: string,
  version: VersionState,
  hash: string | undefined,
  committedLegacyReceipt: boolean,
): Promise<void> {
  const { kind } = metadataFromStorage(version);
  if (kind !== 'product-card' && kind !== 'product-catalog') return;
  const state = await new ProductKnowledgeRepository(dc).state(uid, version.id);
  if (!hash) {
    if (
      committedLegacyReceipt &&
      state.revision === 0 &&
      !state.links.length &&
      !state.profiles.length &&
      !state.aliases.length
    )
      return;
    throw new KnowledgeError('PRODUCT_REVIEW_REQUIRED');
  }
  if (
    hash !== version.productKnowledgeReviewedHash ||
    version.productKnowledgeCatalogRevision !== state.catalogRevision
  )
    throw new KnowledgeError('STALE_STATE');
}
