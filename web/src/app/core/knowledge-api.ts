import type {
  KnowledgeProductWorkspace,
  KnowledgeProductReview,
  SaveKnowledgeProductReviewInput,
  AcceptKnowledgeProductReviewInput,
  GenerateKnowledgeProductAliasesInput,
  SuggestKnowledgeProductLinkInput,
} from '../../../../shared/contracts/product-knowledge/index';
import { metadataFromStorage, isSyntheticSource } from '../../../../shared/knowledge-metadata';
import { Service, inject } from '@angular/core';
import { getIdToken } from 'firebase/auth';
import { getToken as getAppCheckToken } from 'firebase/app-check';
import { QueryFetchPolicy } from 'firebase/data-connect';
import type {
  DocumentSource,
  PdfPageGeometry,
  PdfRect,
  SourceSection,
  CreateDocumentRequest,
  DeleteVersionInput,
  DocumentRow,
  KnowledgeReview,
  RetryDocumentInput,
  ReviewDocumentInput,
  VersionStatus,
} from '../../../../shared/contracts/knowledge/index';
import type { Page, PageInput } from '../../../../shared/contracts/business/index';
import { FIREBASE } from './firebase.providers';
import { getSourceSection } from './generated';
import { runtimeConfig } from './public-config';
import type { PublicConfig } from '../../../../scripts/config/public-config';
import { KnowledgeDocumentsApi } from '../features/procedures/data-access/knowledge-documents-api';

const MAX_PDF_BYTES = 10 * 1024 * 1024;

function pdfRects(value: unknown, viewBox: PdfPageGeometry['viewBox']): PdfRect[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.filter(
    (rect): rect is PdfRect =>
      !!rect &&
      typeof rect === 'object' &&
      ['xMin', 'yMin', 'xMax', 'yMax'].every((key) =>
        Number.isFinite((rect as Record<string, unknown>)[key]),
      ) &&
      rect.xMin < rect.xMax &&
      rect.yMin < rect.yMax &&
      rect.xMin >= viewBox[0] &&
      rect.yMin >= viewBox[1] &&
      rect.xMax <= viewBox[2] &&
      rect.yMax <= viewBox[3],
  );
  return valid.length === value.length ? valid : null;
}

function pageGeometry(value: unknown, userUnit: number, rotation: number): PdfPageGeometry {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every(Number.isFinite) ||
    value[0] >= value[2] ||
    value[1] >= value[3] ||
    !Number.isFinite(userUnit) ||
    userUnit <= 0 ||
    ![0, 90, 180, 270].includes(rotation)
  )
    throw new Error('Source page geometry is invalid.');
  return { viewBox: value as [number, number, number, number], userUnit, rotation };
}

@Service()
export class KnowledgeApi {
  private readonly firebase = inject(FIREBASE);
  private readonly documents = inject(KnowledgeDocumentsApi);

  getProductKnowledge(versionId: string): Promise<KnowledgeProductWorkspace> {
    return this.documents.getProductKnowledge(versionId);
  }
  saveKnowledgeProductReview(
    input: SaveKnowledgeProductReviewInput,
  ): Promise<KnowledgeProductReview> {
    return this.documents.saveKnowledgeProductReview(input);
  }
  acceptKnowledgeProductReview(
    input: AcceptKnowledgeProductReviewInput,
  ): Promise<KnowledgeProductReview> {
    return this.documents.acceptKnowledgeProductReview(input);
  }
  generateKnowledgeProductAliases(
    input: GenerateKnowledgeProductAliasesInput,
  ): Promise<KnowledgeProductReview> {
    return this.documents.generateKnowledgeProductAliases(input);
  }
  suggestKnowledgeProductLink(
    input: SuggestKnowledgeProductLinkInput,
  ): Promise<KnowledgeProductReview> {
    return this.documents.suggestKnowledgeProductLink(input);
  }
  listDocuments(page: PageInput): Promise<Page<DocumentRow>> {
    return this.documents.listDocuments(page);
  }
  getReview(versionId: string): Promise<KnowledgeReview> {
    return this.documents.getReview(versionId);
  }
  createDocumentUpload(input: CreateDocumentRequest): Promise<VersionStatus> {
    return this.documents.createDocumentUpload(input);
  }
  reviewAndPublishDocument(input: ReviewDocumentInput): Promise<VersionStatus> {
    return this.documents.reviewAndPublishDocument(input);
  }
  retryDocumentProcessing(input: RetryDocumentInput): Promise<VersionStatus> {
    return this.documents.retryDocumentProcessing(input);
  }
  deleteKnowledgeVersion(input: DeleteVersionInput): Promise<VersionStatus> {
    return this.documents.deleteKnowledgeVersion(input);
  }
  hashPdf(file: File): Promise<string> {
    return this.documents.hashPdf(file);
  }
  uploadPdf(versionId: string, file: File, signal?: AbortSignal): Promise<VersionStatus> {
    return this.documents.uploadPdf(versionId, file, signal);
  }

  getSource(versionId: string): Promise<DocumentSource>;
  getSource(versionId: string, chunkId: string): Promise<SourceSection>;
  async getSource(versionId: string, chunkId?: string): Promise<DocumentSource | SourceSection> {
    const result = await getSourceSection(
      this.firebase.data,
      { versionId, chunkId: chunkId ?? null },
      { fetchPolicy: QueryFetchPolicy.SERVER_ONLY },
    );
    const version = result.data.membership?.business.versions[0];
    const pageCount = version?.pageCount;
    if (
      !version ||
      version.id !== versionId ||
      version.revokedAt ||
      !Number.isSafeInteger(pageCount) ||
      typeof pageCount !== 'number' ||
      pageCount < 1
    )
      throw new Error('Source is unavailable or access was denied.');
    const source: DocumentSource = {
      businessId: version.businessId,
      documentId: version.documentId,
      versionId: version.id,
      version: version.versionLabel,
      title: version.title,
      language: version.language,
      ...metadataFromStorage(version),
      synthetic: isSyntheticSource(metadataFromStorage(version)),
      superseded: !version.isActive && !!version.publishedAt,
      pageCount,
      pageTexts: version.pages
        .filter(
          (page) =>
            Number.isSafeInteger(page.physicalPage) &&
            page.physicalPage >= 1 &&
            page.physicalPage <= pageCount &&
            typeof page.text === 'string',
        )
        .map((page) => ({ physicalPage: page.physicalPage, text: page.text })),
    };
    if (!chunkId) return source;
    const chunk = version.chunks[0];
    if (!chunk || chunk.id !== chunkId)
      throw new Error('The cited section does not belong to this document version.');
    const page = version.pages.find((candidate) => candidate.physicalPage === chunk.physicalPage);
    if (!page) throw new Error('Source page geometry is missing.');
    const geometry = pageGeometry(page.viewBox, page.userUnit, page.rotation);
    const rects = pdfRects(chunk.rects, geometry.viewBox);
    return {
      ...source,
      chunkId: chunk.id,
      sourceSectionId: chunk.id,
      sectionId: chunk.sectionId,
      physicalPage: chunk.physicalPage,
      excerpt: chunk.text,
      geometry,
      rects: rects ?? [],
      geometryStatus:
        chunk.geometryStatus === 'VERIFIED' && rects?.length ? 'VERIFIED' : 'UNAVAILABLE',
    };
  }

  async getPdf(versionId: string, signal?: AbortSignal): Promise<Uint8Array> {
    const config: PublicConfig | null = runtimeConfig.publicConfig;
    const user = this.firebase.auth.currentUser;
    if (!config || !user) throw new Error('Sign in to open this PDF.');
    const endpoint =
      config.pdfReadUrl ??
      `https://${config.functionsRegion}-${config.projectId}.cloudfunctions.net/getSourcePdf`;
    const url = runtimeConfig.useEmulators
      ? `http://127.0.0.1:5001/${config.projectId}/${config.functionsRegion}/getSourcePdf`
      : endpoint;
    const headers = new Headers({ Authorization: `Bearer ${await getIdToken(user)}` });
    if (!runtimeConfig.useEmulators) {
      const appCheck = await this.firebase.appCheck();
      if (!appCheck) throw new Error('Application verification is unavailable.');
      headers.set('X-Firebase-AppCheck', (await getAppCheckToken(appCheck)).token);
    }
    const response = await fetch(`${url}?versionId=${encodeURIComponent(versionId)}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal,
    });
    if (!response.ok) throw new Error('PDF unavailable or access was denied.');
    if (!response.body) throw new Error('PDF response was empty.');
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_PDF_BYTES) throw new Error('PDF is too large.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PDF_BYTES) throw new Error('PDF is too large.');
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    if (size < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
      throw new Error('PDF response is invalid.');
    return bytes;
  }
}
