import {
  metadataFromStorage,
  isSyntheticSource,
} from '../../../../../../shared/knowledge-metadata';
import type {
  DocumentRow,
  ExtractedPage,
  KnowledgeReview,
  ProcessingStatus,
} from '../../../../../../shared/contracts/knowledge';

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

export interface KnowledgePageRecord {
  physicalPage: number;
  text: string;
  markdown: string;
  spans: unknown;
  printedLabel: string | null;
  quality: 'COMPLETE' | 'NEEDS_REVIEW';
  reviewed: boolean;
  viewBox: unknown;
  userUnit: number;
  rotation: number;
}

function safePageCount(value: number | null): number | null {
  return Number.isSafeInteger(value) && (value ?? 0) >= 1 && (value ?? 31) <= 30 ? value : null;
}

function safeViewBox(value: unknown): [number, number, number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every(Number.isFinite) ||
    value[0] >= value[2] ||
    value[1] >= value[3]
  ) {
    throw new Error('Review page geometry is invalid.');
  }
  return value as [number, number, number, number];
}

function safeSpans(
  value: unknown,
  viewBox: ExtractedPage['viewBox'],
  textLength: number,
): ExtractedPage['spans'] {
  if (!Array.isArray(value)) throw new Error('Review page text geometry is invalid.');
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Review page text geometry is invalid.');
    const span = item as Record<string, unknown>;
    const rect = span['rect'];
    if (!rect || typeof rect !== 'object') throw new Error('Review page text geometry is invalid.');
    const box = rect as Record<string, unknown>;
    const coordinates = ['xMin', 'yMin', 'xMax', 'yMax'] as const;
    if (
      !coordinates.every((key) => typeof box[key] === 'number' && Number.isFinite(box[key])) ||
      typeof span['start'] !== 'number' ||
      !Number.isSafeInteger(span['start']) ||
      typeof span['end'] !== 'number' ||
      !Number.isSafeInteger(span['end']) ||
      span['start'] < 0 ||
      span['end'] < span['start'] ||
      span['end'] > textLength ||
      (box['xMin'] as number) >= (box['xMax'] as number) ||
      (box['yMin'] as number) >= (box['yMax'] as number) ||
      (box['xMin'] as number) < viewBox[0] ||
      (box['yMin'] as number) < viewBox[1] ||
      (box['xMax'] as number) > viewBox[2] ||
      (box['yMax'] as number) > viewBox[3]
    ) {
      throw new Error('Review page text geometry is invalid.');
    }
    return {
      start: span['start'],
      end: span['end'],
      rect: {
        xMin: box['xMin'] as number,
        yMin: box['yMin'] as number,
        xMax: box['xMax'] as number,
        yMax: box['yMax'] as number,
      },
    };
  });
}

export function mapDocumentRow(row: KnowledgeVersionRecord): DocumentRow {
  const pageCount = safePageCount(row.pageCount ?? null);
  const revokedAt = row.revokedAt ?? null;
  const publishedAt = row.publishedAt ?? null;
  const pendingStage = row.pendingStage ?? null;
  const retryable =
    !revokedAt &&
    !publishedAt &&
    row.status !== 'NEEDS_REVIEW' &&
    (pendingStage === 'EXTRACT' || pendingStage === 'PUBLISH') &&
    Boolean(row.processingError) &&
    row.processingError !== 'STALE_STATE';
  return {
    businessId: row.businessId,
    documentId: row.documentId,
    versionId: row.id,
    version: row.versionLabel,
    title: row.title,
    language: row.language,
    ...(row.sourceUrls ? { sourceUrls: row.sourceUrls } : {}),
    ...(row.observedOn !== undefined ? { observedOn: row.observedOn } : {}),
    ...metadataFromStorage(row),
    synthetic: isSyntheticSource(metadataFromStorage(row)),
    superseded: !row.isActive && Boolean(publishedAt),
    pageCount,
    versionRevision: row.revision,
    documentRevision: row.document.revision,
    status: row.status,
    retryable,
    ...(row.processingError ? { errorCode: row.processingError } : {}),
    revokedAt,
    createdAt: row.createdAt,
    pdfSha256: row.pdfSha256,
    publishedAt,
    pendingStage,
  };
}

export function mapKnowledgeReview(
  row: KnowledgeVersionRecord,
  extractionHash: string | null,
  pageRecords: KnowledgePageRecord[],
): KnowledgeReview {
  const version = mapDocumentRow(row);
  const pages = pageRecords.map((page): ExtractedPage & { reviewed: boolean } => {
    const viewBox = safeViewBox(page.viewBox);
    if (
      !Number.isSafeInteger(page.physicalPage) ||
      page.physicalPage < 1 ||
      !Number.isFinite(page.userUnit) ||
      page.userUnit <= 0 ||
      ![0, 90, 180, 270].includes(page.rotation)
    ) {
      throw new Error('Review page metadata is invalid.');
    }
    return {
      physicalPage: page.physicalPage,
      text: page.text,
      markdown: page.markdown,
      spans: safeSpans(page.spans, viewBox, page.text.length),
      viewBox,
      userUnit: page.userUnit,
      rotation: page.rotation,
      quality: page.quality,
      reviewed: page.reviewed,
    };
  });
  const expectedPageCount = version.pageCount;
  const fullPageSet =
    expectedPageCount !== null &&
    pages.length === expectedPageCount &&
    pages.every((page, index) => page.physicalPage === index + 1);
  const completePageSet = fullPageSet && pages.every((page) => page.quality === 'COMPLETE');
  const freshReview = row.status === 'EXTRACTED';
  const staleReadyReview =
    row.status === 'READY' &&
    row.processingError === 'STALE_STATE' &&
    row.pendingStage === null &&
    pages.every((page) => page.reviewed);
  return {
    version,
    extractionHash: extractionHash ?? '',
    pages,
    publicationAllowed:
      completePageSet &&
      Boolean(extractionHash) &&
      row.publicationStatus === 'DEMO_CURRENT' &&
      !row.revokedAt &&
      !row.publishedAt &&
      (freshReview || staleReadyReview),
  };
}
