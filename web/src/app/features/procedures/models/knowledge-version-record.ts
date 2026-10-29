import type { ProcessingStatus } from '../../../../../../shared/contracts/knowledge/index';

export interface KnowledgeVersionRecord {
  id: string;
  documentId: string;
  businessId: string;
  versionLabel: string;
  title: string;
  language: string;
  sourceUrls?: string[];
  observedOn?: string | null;
  sourceType: 'SYNTHETIC_PROCEDURE' | 'PUBLIC_PRODUCT_SUMMARY' | null;
  kind?: string | null;
  origin?: string | null;
  synthetic: boolean;
  publicationStatus: 'DEMO_CURRENT' | 'RETIRED';
  isActive: boolean;
  pageCount?: number | null;
  status: ProcessingStatus;
  revision: number;
  document: { activeVersionId?: string | null; revision: number };
  revokedAt: string | null;
  pdfSha256: string;
  publishedAt: string | null;
  pendingStage?: 'EXTRACT' | 'PUBLISH' | null;
  processingError?: string | null;
  extractionHash?: string | null;
  createdAt: string;
}
