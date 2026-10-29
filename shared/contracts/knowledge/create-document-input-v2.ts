import type { KnowledgeMetadata } from './knowledge-metadata.js';
import type { LegacyCreateDocumentInput } from './legacy-create-document-input.js';
export type CreateDocumentInputV2 = Omit<LegacyCreateDocumentInput, 'sourceType'> &
  KnowledgeMetadata;
