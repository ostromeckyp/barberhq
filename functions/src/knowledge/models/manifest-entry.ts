import type { KnowledgeMetadata } from '../../../../shared/contracts/knowledge/index.js';

export type ManifestEntry = {
  documentId: string;
  version: string;
  title: string;
  language: string;
  businessKey: string;
  kind: KnowledgeMetadata['kind'];
  origin: KnowledgeMetadata['origin'];
  publicationStatus: 'demo-current' | 'retired';
  /** Product cards only: the seeded product this card belongs to. */
  productDemoId?: string;
  /** Procedures only: the delivery problem kind the demo binds to this document. */
  deliveryProblemKind?: 'DAMAGED' | 'MISSING';
  inputPdf: string;
  sha256: string;
  sourceUrls: string[];
  observedOn: string | null;
};
