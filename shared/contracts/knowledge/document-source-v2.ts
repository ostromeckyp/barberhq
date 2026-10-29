import type { KnowledgeMetadata } from './knowledge-metadata.js';
import type { LegacyDocumentSource } from './legacy-document-source.js';
export type DocumentSourceV2 = Omit<LegacyDocumentSource, 'sourceType'> & KnowledgeMetadata;
