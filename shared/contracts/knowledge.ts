export type PdfRect = { xMin: number; yMin: number; xMax: number; yMax: number };
export type GeometryStatus = 'VERIFIED' | 'UNAVAILABLE';
export type ProcessingStatus =
  'STAGED' | 'EXTRACTED' | 'REVIEWED' | 'EMBEDDED' | 'READY' | 'NEEDS_REVIEW' | 'FAILED';
export type PdfPageGeometry = {
  viewBox: [number, number, number, number];
  userUnit: number;
  rotation: number;
};
export type ExtractedPage = PdfPageGeometry & {
  physicalPage: number;
  text: string;
  markdown: string;
  spans: { start: number; end: number; rect: PdfRect }[];
  quality: 'COMPLETE' | 'NEEDS_REVIEW';
};
export type ExtractedDocument = {
  title: string;
  pages: ExtractedPage[];
  quality: 'COMPLETE' | 'NEEDS_REVIEW';
  parserVersion: string;
  extractionHash: string;
};
export type KnowledgeChunkDraft = {
  page: number;
  ordinal: number;
  sectionId: string;
  heading: string;
  text: string;
  start: number;
  end: number;
  rects: PdfRect[];
  geometryStatus: GeometryStatus;
};

export type ProcessingResult = {
  versionId: string;
  status: ProcessingStatus;
  retryable: boolean;
  errorCode?: string;
};
export type VersionStatus = ProcessingResult & {
  documentId: string;
  documentRevision: number;
  versionRevision: number;
  revokedAt: string | null;
};
type LegacyDocumentSource = {
  businessId: string;
  documentId: string;
  versionId: string;
  version: string;
  title: string;
  language: string;
  synthetic: boolean;
  sourceType: 'synthetic-procedure' | 'public-product-summary';
  superseded: boolean;
  pageCount: number;
  pageTexts?: { physicalPage: number; text: string }[];
};
export type SourceSection = DocumentSource & {
  chunkId: string;
  sourceSectionId: string;
  sectionId: string;
  physicalPage: number;
  excerpt: string;
  geometry: PdfPageGeometry;
  rects: PdfRect[];
  geometryStatus: GeometryStatus;
};
export type DocumentRow = Omit<DocumentSource, 'pageCount'> &
  VersionStatus & {
    pageCount: number | null;
    createdAt: string;
    pdfSha256: string;
    publishedAt: string | null;
    pendingStage: 'EXTRACT' | 'PUBLISH' | null;
    sourceUrls?: string[];
    observedOn?: string | null;
  };
export type KnowledgeReview = {
  version: DocumentRow;
  extractionHash: string;
  pages: (ExtractedPage & { reviewed: boolean })[];
  publicationAllowed: boolean;
};

export type LegacyCreateDocumentInput = {
  title: string;
  language: 'en' | 'pl';
  sourceType: 'synthetic-procedure' | 'public-product-summary';
  sourceUrls: string[];
  observedOn: string | null;
  sha256: string;
  idempotencyKey: string;
  documentId?: string;
  expectedDocumentRevision?: number;
};
export type ReviewDocumentInput = {
  versionId: string;
  extractionHash: string;
  reviewedPhysicalPages: number[];
  expectedDocumentRevision: number;
  idempotencyKey: string;
  productKnowledgeReviewedHash?: string;
};
export type RetryDocumentInput = { versionId: string; sha256: string; idempotencyKey: string };
export type DeleteVersionInput = {
  versionId: string;
  expectedDocumentRevision: number;
  expectedVersionRevision: number;
  idempotencyKey: string;
};

export type KnowledgeDocumentKind = 'procedure' | 'policy' | 'product-card' | 'product-catalog';
export type KnowledgeOrigin = 'official' | 'public-compilation' | 'synthetic';
export type KnowledgeMetadata = { kind: KnowledgeDocumentKind; origin: KnowledgeOrigin };
export type DocumentSourceV2 = Omit<LegacyDocumentSource, 'sourceType'> & KnowledgeMetadata;
export type CreateDocumentInputV2 = Omit<LegacyCreateDocumentInput, 'sourceType'> &
  KnowledgeMetadata;
export type CreateDocumentRequest = LegacyCreateDocumentInput | CreateDocumentInputV2;
export type CreateDocumentInput = CreateDocumentInputV2;
export type DocumentSource = DocumentSourceV2;
