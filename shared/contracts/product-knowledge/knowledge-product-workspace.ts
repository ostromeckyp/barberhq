import type { KnowledgeCatalogProduct } from './knowledge-catalog-product.js';
import type { KnowledgePassage } from './knowledge-passage.js';
import type { KnowledgeProductReview } from './knowledge-product-review.js';
export type KnowledgeProductWorkspace = {
  kind?: 'product-card' | 'product-catalog';
  review: KnowledgeProductReview;
  catalog: KnowledgeCatalogProduct[];
  passages: KnowledgePassage[];
  readOnly: boolean;
};
