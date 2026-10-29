import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import type { DocumentRow } from '../../../../../../shared/contracts/knowledge/index';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SalonContext } from '../../../core/salon-context';
import { SessionFacade } from '../../auth/feature/session.facade';
import { DocumentLibraryFacade } from './document-library.facade';

const row: DocumentRow = {
  businessId: 'business',
  documentId: 'DOC-1',
  versionId: 'DOC-1:v1',
  version: 'v1',
  title: 'Procedure',
  language: 'en',
  synthetic: true,
  kind: 'procedure',
  origin: 'synthetic',
  superseded: false,
  pageCount: null,
  documentRevision: 2,
  versionRevision: 1,
  status: 'FAILED',
  retryable: true,
  errorCode: 'QUEUE_UNAVAILABLE',
  revokedAt: null,
  createdAt: '2026-10-19T00:00:00Z',
  pdfSha256: 'a'.repeat(64),
  publishedAt: null,
  pendingStage: 'EXTRACT',
};
afterEach(() => {
  TestBed.resetTestingModule();
  sessionStorage.clear();
});

it('replays the identical retry command after an unknown result', async () => {
  const retryDocumentProcessing = vi.fn().mockRejectedValue({ code: 'UPLOAD_FAILED' });
  TestBed.configureTestingModule({
    providers: [
      DocumentLibraryFacade,
      {
        provide: KnowledgeApi,
        useValue: {
          listDocuments: vi.fn().mockResolvedValue({ items: [row], nextOffset: null }),
          retryDocumentProcessing,
        },
      },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
          }),
        },
      },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
    ],
  });
  const facade = TestBed.inject(DocumentLibraryFacade);
  await facade.retry(row);
  await facade.retry(row);
  expect(retryDocumentProcessing).toHaveBeenCalledTimes(2);
  expect(retryDocumentProcessing.mock.calls[0][0]).toEqual(
    retryDocumentProcessing.mock.calls[1][0],
  );
  expect(retryDocumentProcessing.mock.calls[0][0]).toMatchObject({
    versionId: row.versionId,
    sha256: row.pdfSha256,
    idempotencyKey: expect.any(String),
  });
});

it('restores an unresolved command after leaving and reopening the library in the same session', async () => {
  const membership = { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] };
  const firstRetry = vi.fn().mockRejectedValue({ code: 'UPLOAD_FAILED' });
  TestBed.configureTestingModule({
    providers: [
      DocumentLibraryFacade,
      {
        provide: KnowledgeApi,
        useValue: {
          listDocuments: vi.fn().mockResolvedValue({ items: [row], nextOffset: null }),
          retryDocumentProcessing: firstRetry,
        },
      },
      { provide: SessionFacade, useValue: { state: signal({ status: 'READY', membership }) } },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
    ],
  });
  const first = TestBed.inject(DocumentLibraryFacade);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  await first.retry(row);
  const frozen = firstRetry.mock.calls[0][0];
  TestBed.resetTestingModule();

  const secondRetry = vi.fn(async () => ({
    versionId: row.versionId,
    documentId: row.documentId,
    status: 'STAGED' as const,
    retryable: false,
    documentRevision: row.documentRevision,
    versionRevision: row.versionRevision,
    revokedAt: null,
  }));
  TestBed.configureTestingModule({
    providers: [
      DocumentLibraryFacade,
      {
        provide: KnowledgeApi,
        useValue: {
          listDocuments: vi.fn().mockResolvedValue({ items: [row], nextOffset: null }),
          retryDocumentProcessing: secondRetry,
        },
      },
      { provide: SessionFacade, useValue: { state: signal({ status: 'READY', membership }) } },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
    ],
  });
  const second = TestBed.inject(DocumentLibraryFacade);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  await second.retry(row);
  expect(secondRetry).toHaveBeenCalledWith(frozen);
});

it('polls only while visible and ready, then removes listeners when the facade is destroyed', async () => {
  const session = signal({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
  });
  const listDocuments = vi.fn(async () => ({ items: [row], nextOffset: null }));
  TestBed.configureTestingModule({
    providers: [
      DocumentLibraryFacade,
      { provide: KnowledgeApi, useValue: { listDocuments } },
      { provide: SessionFacade, useValue: { state: session } },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
    ],
  });
  TestBed.inject(DocumentLibraryFacade);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  const initialCalls = listDocuments.mock.calls.length;
  const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  expect(listDocuments).toHaveBeenCalledTimes(initialCalls);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  await TestBed.inject(ApplicationRef).whenStable();
  expect(listDocuments).toHaveBeenCalledTimes(initialCalls + 1);
  session.set({ status: 'SIGNED_OUT', membership: undefined as never });
  TestBed.tick();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(listDocuments).toHaveBeenCalledTimes(initialCalls + 1);
  TestBed.resetTestingModule();
  document.dispatchEvent(new Event('visibilitychange'));
  expect(listDocuments).toHaveBeenCalledTimes(initialCalls + 1);
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  else Reflect.deleteProperty(document, 'visibilityState');
});

it('keeps replacement discovery bounded to the HQ paginated list', async () => {
  const secondPage = {
    ...row,
    documentId: 'DOC-21',
    versionId: 'DOC-21:v1',
    title: 'Other page document',
  };
  const listDocuments = vi
    .fn()
    .mockResolvedValueOnce({ items: [row], nextOffset: 20 })
    .mockResolvedValueOnce({ items: [secondPage], nextOffset: null });
  TestBed.configureTestingModule({
    providers: [
      DocumentLibraryFacade,
      { provide: KnowledgeApi, useValue: { listDocuments } },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
          }),
        },
      },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
    ],
  });
  const facade = TestBed.inject(DocumentLibraryFacade);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  expect(facade.rows()).toEqual([row]);
  expect(facade.hasMore()).toBe(true);
  facade.next();
  await TestBed.inject(ApplicationRef).whenStable();
  expect(listDocuments).toHaveBeenLastCalledWith({ limit: 20, offset: 20 });
  expect(facade.rows()).toEqual([secondPage]);
  expect(facade.hasMore()).toBe(false);
});

it('reports a confirmed withdrawal by its outcome, not its unchanged processing status', async () => {
  const deleteKnowledgeVersion = vi.fn(async () => ({
    ...row,
    status: 'READY' as const,
    revokedAt: '2026-10-19T12:00:00Z',
  }));
  TestBed.configureTestingModule({
    providers: [
      DocumentLibraryFacade,
      {
        provide: KnowledgeApi,
        useValue: {
          listDocuments: vi.fn().mockResolvedValue({ items: [row], nextOffset: null }),
          deleteKnowledgeVersion,
        },
      },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
          }),
        },
      },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
    ],
  });
  const facade = TestBed.inject(DocumentLibraryFacade);
  await facade.withdraw(row);
  expect(facade.notice()).toBe(
    'Version withdrawn. Private originals and audit records are retained.',
  );
});

it('describes a confirmed READY retry result without exposing the processing enum', async () => {
  const retryDocumentProcessing = vi.fn(async () => ({
    ...row,
    status: 'READY' as const,
    revokedAt: null,
  }));
  TestBed.configureTestingModule({
    providers: [
      DocumentLibraryFacade,
      {
        provide: KnowledgeApi,
        useValue: {
          listDocuments: vi.fn().mockResolvedValue({ items: [row], nextOffset: null }),
          retryDocumentProcessing,
        },
      },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
          }),
        },
      },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
    ],
  });
  const facade = TestBed.inject(DocumentLibraryFacade);
  await facade.retry(row);
  expect(facade.notice()).toBe('Processing completed successfully for this version.');
  expect(facade.notice()).not.toContain('READY');
});
