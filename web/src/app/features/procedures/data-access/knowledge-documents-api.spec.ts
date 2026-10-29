import { describe, expect, it, vi } from 'vitest';
import type { KnowledgePageRecord } from '../models/knowledge-page-record';
import type { KnowledgeVersionRecord } from '../models/knowledge-version-record';
import { mapDocumentRow, mapKnowledgeReview } from './knowledge.mapper';
import { normalizePage, shouldLoadHqDocumentRows } from './knowledge-documents-api';
import {
  hashPdf,
  KnowledgeApiError,
  mapKnowledgeError,
  MAX_KNOWLEDGE_PDF_BYTES,
  uploadKnowledgePdf,
} from './knowledge-http';

function row(overrides: Partial<KnowledgeVersionRecord> = {}): KnowledgeVersionRecord {
  return {
    id: 'doc:v1',
    documentId: 'doc',
    businessId: 'business',
    versionLabel: 'v1',
    title: 'Procedure',
    language: 'en',
    sourceType: 'SYNTHETIC_PROCEDURE',
    synthetic: true,
    publicationStatus: 'DEMO_CURRENT',
    isActive: true,
    pageCount: null,
    status: 'STAGED',
    revision: 1,
    document: { activeVersionId: null, revision: 0 },
    revokedAt: null,
    pdfSha256: 'a'.repeat(64),
    publishedAt: null,
    pendingStage: 'EXTRACT',
    processingError: null,
    createdAt: '2026-10-16T00:00:00Z',
    ...overrides,
  };
}

const page: KnowledgePageRecord = {
  physicalPage: 1,
  text: 'Text',
  markdown: 'Text',
  spans: [],
  printedLabel: null,
  quality: 'COMPLETE',
  reviewed: false,
  viewBox: [0, 0, 612, 792],
  userUnit: 1,
  rotation: 0,
};

describe('document DTO mapping', () => {
  it('uses management rows only in HQ workspace and published-only rows while acting for a salon', () => {
    expect(shouldLoadHqDocumentRows('HQ', { kind: 'HQ' })).toBe(true);
    expect(shouldLoadHqDocumentRows('HQ', { kind: 'SALON', salonId: 'salon-a' })).toBe(false);
    expect(shouldLoadHqDocumentRows('SALON', { kind: 'SALON', salonId: 'salon-a' })).toBe(false);
  });
  it('preserves null page count before upload and derives retryability from durable stage state', () => {
    const staged = mapDocumentRow(row({ status: 'FAILED', processingError: 'QUEUE_UNAVAILABLE' }));
    expect(staged).toMatchObject({
      pageCount: null,
      retryable: true,
      pendingStage: 'EXTRACT',
      pdfSha256: 'a'.repeat(64),
    });
    expect(
      mapDocumentRow(row({ status: 'FAILED', processingError: 'STALE_STATE' })).retryable,
    ).toBe(false);
    expect(
      mapDocumentRow(row({ status: 'NEEDS_REVIEW', processingError: 'EXTRACTION_INCOMPLETE' }))
        .retryable,
    ).toBe(false);
    expect(
      mapDocumentRow(
        row({ status: 'FAILED', pendingStage: null, processingError: 'QUEUE_UNAVAILABLE' }),
      ).retryable,
    ).toBe(false);
  });

  it('does not make an errored row retryable when its pending stage is missing', () => {
    const missingStage = mapDocumentRow(
      row({ status: 'FAILED', pendingStage: undefined, processingError: 'QUEUE_UNAVAILABLE' }),
    );
    expect(missingStage).toMatchObject({ retryable: false, pendingStage: null });
  });

  it('marks any published nonactive version superseded and preserves its publication time', () => {
    expect(
      mapDocumentRow(
        row({ isActive: false, status: 'READY', publishedAt: '2026-10-15T12:00:00Z' }),
      ),
    ).toMatchObject({ superseded: true, publishedAt: '2026-10-15T12:00:00Z' });
  });

  it('allows eligible fresh and stale review submissions without using persisted flags as operator checks', () => {
    const reviewed = { ...page, reviewed: true };
    const extracted = row({
      status: 'EXTRACTED',
      pageCount: 1,
      pendingStage: null,
      publishedAt: null,
    });
    const staleReady = row({
      status: 'READY',
      pageCount: 1,
      pendingStage: null,
      processingError: 'STALE_STATE',
      publishedAt: null,
    });
    expect(mapKnowledgeReview(extracted, 'b'.repeat(64), [page]).publicationAllowed).toBe(true);
    expect(mapKnowledgeReview(staleReady, 'b'.repeat(64), [reviewed]).publicationAllowed).toBe(
      true,
    );
    expect(mapKnowledgeReview(staleReady, 'b'.repeat(64), [page]).publicationAllowed).toBe(false);
    expect(
      mapKnowledgeReview(row({ ...extracted, publicationStatus: 'RETIRED' }), 'b'.repeat(64), [
        page,
      ]).publicationAllowed,
    ).toBe(false);
    expect(
      mapKnowledgeReview(row({ ...extracted, revokedAt: '2026-10-16T00:00:00Z' }), 'b'.repeat(64), [
        page,
      ]).publicationAllowed,
    ).toBe(false);
    expect(
      mapKnowledgeReview(
        row({ ...extracted, publishedAt: '2026-10-16T00:00:00Z' }),
        'b'.repeat(64),
        [page],
      ).publicationAllowed,
    ).toBe(false);
    expect(
      mapKnowledgeReview(row({ ...extracted, status: 'STAGED' }), 'b'.repeat(64), [page])
        .publicationAllowed,
    ).toBe(false);
    expect(mapKnowledgeReview(extracted, null, [page]).publicationAllowed).toBe(false);
    expect(mapKnowledgeReview(extracted, 'b'.repeat(64), []).publicationAllowed).toBe(false);
    expect(
      mapKnowledgeReview(row({ ...staleReady, pendingStage: 'PUBLISH' }), 'b'.repeat(64), [
        reviewed,
      ]).publicationAllowed,
    ).toBe(false);
    expect(
      mapKnowledgeReview(row({ ...staleReady, pendingStage: undefined }), 'b'.repeat(64), [
        reviewed,
      ]).publicationAllowed,
    ).toBe(false);
    expect(
      mapKnowledgeReview(row({ ...staleReady, processingError: null }), 'b'.repeat(64), [reviewed])
        .publicationAllowed,
    ).toBe(false);
  });

  it('normalizes default pages and rejects unbounded or invalid pagination', () => {
    expect(normalizePage()).toEqual({ limit: 50, offset: 0 });
    expect(normalizePage({ limit: 10, offset: 20 })).toEqual({ limit: 10, offset: 20 });
    expect(() => normalizePage({ limit: 51, offset: 0 })).toThrow(RangeError);
    expect(() => normalizePage({ limit: 50, offset: -1 })).toThrow(RangeError);
  });
});

describe('knowledge upload transport', () => {
  it('maps callable and upload error codes to stable API errors', () => {
    expect(
      mapKnowledgeError({ code: 'functions/permission-denied', message: 'denied' }),
    ).toMatchObject({ code: 'FORBIDDEN' });
    expect(mapKnowledgeError(new Error('STALE_STATE'))).toMatchObject({ code: 'STALE_STATE' });
    expect(mapKnowledgeError(new Error('TOO_LARGE'))).toMatchObject({ code: 'UPLOAD_TOO_LARGE' });
    expect(mapKnowledgeError(new Error('UPLOAD_UNAVAILABLE'))).toMatchObject({
      code: 'OUTCOME_UNKNOWN',
    });
    expect(
      mapKnowledgeError({
        code: 'functions/failed-precondition',
        details: { code: 'STALE_STATE' },
      }),
    ).toMatchObject({ code: 'STALE_STATE' });
    expect(mapKnowledgeError(new Error('service unavailable'))).toMatchObject({
      code: 'UPLOAD_FAILED',
    });
  });

  it('hashes a newly selected PDF locally and rejects malformed input', async () => {
    const file = new File(['%PDF-test'], 'test.pdf', { type: 'application/pdf' });
    expect(await hashPdf(file)).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      hashPdf(new File(['plain text'], 'bad.pdf', { type: 'application/pdf' })),
    ).rejects.toMatchObject({ code: 'INVALID_PDF' });
  });

  it('sends a bounded raw PDF with strict versionId, Auth and App Check headers', async () => {
    const file = new File(['%PDF-test'], 'test.pdf', { type: 'application/pdf' });
    let captured: { url: string; init?: RequestInit } | undefined;
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(input), init };
      return new Response(
        JSON.stringify({
          versionId: 'doc:v1',
          status: 'STAGED',
          retryable: false,
          documentId: 'doc',
          documentRevision: 1,
          versionRevision: 1,
          revokedAt: null,
        }),
        { status: 200 },
      );
    });
    await uploadKnowledgePdf({
      url: 'https://example.invalid/upload?ignored=yes',
      versionId: 'doc:v1',
      file,
      authToken: 'auth',
      appCheckToken: 'app',
      fetcher,
    });
    expect(captured?.url).toBe('https://example.invalid/upload?versionId=doc%3Av1');
    expect(captured?.init?.method).toBe('POST');
    const headers = new Headers(captured?.init?.headers);
    expect(headers.get('authorization')).toBe('Bearer auth');
    expect(headers.get('x-firebase-appcheck')).toBe('app');
    expect(headers.get('content-type')).toBe('application/pdf');
    expect(captured?.init?.body).toBe(file);
  });

  it('does not send aborted or oversized files', async () => {
    const fetcher = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const small = new File(['%PDF-test'], 'test.pdf', { type: 'application/pdf' });
    await expect(
      uploadKnowledgePdf({
        url: 'https://example.invalid/upload',
        versionId: 'doc:v1',
        file: small,
        authToken: 'auth',
        appCheckToken: null,
        signal: controller.signal,
        fetcher,
      }),
    ).rejects.toHaveProperty('name', 'AbortError');
    const oversized = new File([new Uint8Array(MAX_KNOWLEDGE_PDF_BYTES + 1)], 'large.pdf', {
      type: 'application/pdf',
    });
    await expect(
      uploadKnowledgePdf({
        url: 'https://example.invalid/upload',
        versionId: 'doc:v1',
        file: oversized,
        authToken: 'auth',
        appCheckToken: null,
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_TOO_LARGE' } satisfies Partial<KnowledgeApiError>);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('aborts an in-flight upload through the provided signal', async () => {
    const controller = new AbortController();
    const file = new File(['%PDF-test'], 'test.pdf', { type: 'application/pdf' });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      markStarted();
      return new Promise<Response>((_resolve, reject) => {
        if (init?.signal?.aborted) reject(new DOMException('Aborted', 'AbortError'));
        else
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
      });
    });
    const pending = uploadKnowledgePdf({
      url: 'https://example.invalid/upload',
      versionId: 'doc:v1',
      file,
      authToken: 'auth',
      appCheckToken: null,
      signal: controller.signal,
      fetcher,
    });
    await started;
    controller.abort();
    await expect(pending).rejects.toHaveProperty('name', 'AbortError');
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

it('maps canonical independent classification and rejects contradictory retained metadata', () => {
  expect(
    mapDocumentRow(row({ kind: 'PRODUCT_CARD', origin: 'SYNTHETIC', sourceType: null })),
  ).toMatchObject({ kind: 'product-card', origin: 'synthetic', synthetic: true });
  expect(
    mapDocumentRow(row({ kind: 'POLICY', origin: 'OFFICIAL', sourceType: null, synthetic: false })),
  ).toMatchObject({ kind: 'policy', origin: 'official', synthetic: false });
  expect(() =>
    mapDocumentRow(
      row({
        kind: 'POLICY',
        origin: 'OFFICIAL',
        sourceType: 'SYNTHETIC_PROCEDURE',
        synthetic: true,
      }),
    ),
  ).toThrow();
});

it('preserves product operation recovery codes instead of treating them as generic version failures', async () => {
  const { mapKnowledgeError } = await import('./knowledge-http');
  expect(
    mapKnowledgeError({ code: 'functions/failed-precondition', details: { code: 'IN_PROGRESS' } })
      .code,
  ).toBe('IN_PROGRESS');
  expect(
    mapKnowledgeError({ code: 'functions/unavailable', details: { code: 'TIMEOUT' } }).code,
  ).toBe('TIMEOUT');
});
