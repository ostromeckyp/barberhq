import type { ProductKnowledgeProviderOptions } from './product-knowledge-provider-options.js';

export type ProductKnowledgeProvider = (
  options: ProductKnowledgeProviderOptions,
) => Promise<{ output: unknown }>;
