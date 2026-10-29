import type { KnowledgeProductReview } from '../../../../shared/contracts/product-knowledge/index.js';

export type ProductOperation = {
  id: string;
  business_id: string;
  version_id: string;
  actor_uid: string;
  idempotency_key: string;
  action: string;
  payload_hash: string;
  result: KnowledgeProductReview | null;
  generation_id: string | null;
  lease_expires_at: string | null;
  completed_at: string | null;
  created_at: string;
};
