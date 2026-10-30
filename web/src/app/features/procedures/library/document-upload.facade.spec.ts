import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  CreateDocumentInput,
  DocumentRow,
  VersionStatus,
} from '../../../../../../shared/contracts/knowledge/index';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SalonContext } from '../../../core/salon-context';
import { SessionFacade } from '../../auth/feature/session.facade';
import { DocumentUploadFacade } from './document-upload.facade';
import type { UploadDialogData } from '../models/upload-dialog-data';
import type { UploadFormValue } from '../models/upload-form-value';

const sha256 = 'c'.repeat(64);
const staged: DocumentRow = {
  businessId: 'business',
  documentId: 'DOC-1',
  versionId: 'DOC-1:v2',
  version: 'v2',
  title: 'Procedure',
  language: 'en',
  synthetic: true,
  kind: 'procedure',
  origin: 'synthetic',
  superseded: false,
  pageCount: null,
  documentRevision: 3,
  versionRevision: 1,
  status: 'STAGED',
  retryable: false,
  revokedAt: null,
  createdAt: '2026-10-19T00:00:00Z',
  pdfSha256: sha256,
  publishedAt: null,
  pendingStage: 'EXTRACT',
};
const form: UploadFormValue = {
  title: 'New procedure',
  language: 'en',
  kind: 'procedure',
  origin: 'synthetic',
  sourceUrls: '',
  observedOn: '',
};
const accepted: VersionStatus = {
  versionId: staged.versionId,
  documentId: staged.documentId,
  status: 'STAGED',
  retryable: false,
  documentRevision: 3,
  versionRevision: 1,
  revokedAt: null,
};
afterEach(() => {
  TestBed.resetTestingModule();
  sessionStorage.clear();
});

function setup(api: object, data: UploadDialogData = { resume: staged }) {
  const dialog = { close: vi.fn(), disableClose: false };
  const sessionState = signal({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
  });
  const workspace = signal<{ kind: 'HQ' } | { kind: 'SALON'; salonId: string }>({ kind: 'HQ' });
  TestBed.configureTestingModule({
    providers: [
      DocumentUploadFacade,
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: dialog },
      { provide: KnowledgeApi, useValue: api },
      { provide: SessionFacade, useValue: { state: sessionState } },
      { provide: SalonContext, useValue: { workspace } },
    ],
  });
  return { facade: TestBed.inject(DocumentUploadFacade), dialog, sessionState, workspace };
}

it('clears a previously valid file when a later selection is invalid', async () => {
  const createDocumentUpload = vi.fn();
  const h = setup({ hashPdf: vi.fn(async () => sha256), createDocumentUpload }, {});
  const valid = new File(['%PDF-original'], 'procedure.pdf', { type: 'application/pdf' });
  h.facade.selectFiles([valid]);
  expect(h.facade.fileName()).toBe('procedure.pdf');
  const invalid = new File(['not a pdf'], 'notes.txt', { type: 'text/plain' });
  h.facade.selectFiles([invalid]);
  expect(h.facade.fileName()).toBe('');
  await h.facade.submit(form);
  expect(createDocumentUpload).not.toHaveBeenCalled();
});

it('rejects multiple files instead of silently selecting the first PDF', () => {
  const h = setup({ hashPdf: vi.fn() }, {});
  const files = [
    new File(['%PDF-one'], 'one.pdf', { type: 'application/pdf' }),
    new File(['%PDF-two'], 'two.pdf', { type: 'application/pdf' }),
  ];
  h.facade.selectFiles(files);
  expect(h.facade.fileName()).toBe('');
  expect(h.facade.error()).toEqual({ key: 'procedures.upload.errors.oneFile' });
});

it('rejects a PDF larger than 10 MiB and clears the previous valid selection', () => {
  const h = setup({ hashPdf: vi.fn() }, {});
  h.facade.selectFiles([new File(['small'], 'valid.pdf', { type: 'application/pdf' })]);
  const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', {
    type: 'application/pdf',
  });
  h.facade.selectFiles([oversized]);
  expect(h.facade.fileName()).toBe('');
  expect(h.facade.error()).toEqual({ key: 'procedures.errors.pdfTooLarge' });
});

it('uses the explicitly selected logical document and revision for replacement', async () => {
  const createDocumentUpload = vi.fn(async () => accepted);
  const uploadPdf = vi.fn(async () => accepted);
  const target = {
    documentId: 'DOC-OLD',
    documentRevision: 7,
    title: 'Unsupported guide',
    version: 'v3',
  };
  const h = setup(
    { hashPdf: vi.fn(async () => sha256), createDocumentUpload, uploadPdf },
    { replaceTarget: target },
  );
  const file = new File(['%PDF-supported'], 'replacement.pdf', { type: 'application/pdf' });
  h.facade.selectFiles([file]);
  await h.facade.submit(form);
  expect(createDocumentUpload).toHaveBeenCalledWith(
    expect.objectContaining({ documentId: 'DOC-OLD', expectedDocumentRevision: 7 }),
  );
});

it('removes pending registration and staged metadata on sign-out or workspace change', () => {
  sessionStorage.setItem(
    'barberhq:document-upload:hq:business:new',
    JSON.stringify({ idempotencyKey: 'one' }),
  );
  sessionStorage.setItem(
    'barberhq:document-upload:hq:business:replace:DOC-A',
    JSON.stringify({ idempotencyKey: 'two' }),
  );
  sessionStorage.setItem(
    'barberhq:document-upload:hq:business:replace:DOC-A:staged',
    JSON.stringify({ versionId: 'DOC-1:v2' }),
  );
  const h = setup({ hashPdf: vi.fn() }, {});
  TestBed.tick();
  expect(sessionStorage.length).toBe(3);
  h.sessionState.set({ status: 'SIGNED_OUT', membership: undefined as never });
  TestBed.tick();
  expect(sessionStorage.length).toBe(0);

  sessionStorage.setItem(
    'barberhq:document-upload:hq:business:new',
    JSON.stringify({ idempotencyKey: 'three' }),
  );
  sessionStorage.setItem(
    'barberhq:document-upload:hq:business:replace:DOC-A',
    JSON.stringify({ idempotencyKey: 'four' }),
  );
  h.sessionState.set({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
  });
  TestBed.tick();
  h.workspace.set({ kind: 'SALON', salonId: 'salon-1' });
  TestBed.tick();
  expect(sessionStorage.length).toBe(0);
});

it('reuploads a staged version only when the selected PDF matches its registered hash', async () => {
  const uploadPdf = vi.fn(async () => accepted);
  const h = setup({ hashPdf: vi.fn(async () => sha256), uploadPdf });
  const file = new File(['%PDF-original'], 'procedure.pdf', { type: 'application/pdf' });
  h.facade.selectFiles([file]);
  await h.facade.submit(form);
  expect(uploadPdf).toHaveBeenCalledWith(staged.versionId, file, expect.any(AbortSignal));
  expect(h.dialog.close).toHaveBeenCalledWith(accepted);
});

it('keeps the same registration payload and idempotency key after an unknown create result', async () => {
  const createDocumentUpload = vi
    .fn()
    .mockRejectedValueOnce({ code: 'UPLOAD_FAILED' })
    .mockResolvedValueOnce(accepted);
  const uploadPdf = vi.fn(async () => accepted);
  const h = setup({ hashPdf: vi.fn(async () => sha256), createDocumentUpload, uploadPdf }, {});
  const file = new File(['%PDF-original'], 'procedure.pdf', { type: 'application/pdf' });
  h.facade.selectFiles([file]);
  await h.facade.submit(form);
  await h.facade.submit(form);
  expect(createDocumentUpload).toHaveBeenCalledTimes(2);
  expect(createDocumentUpload.mock.calls[0][0]).toEqual(createDocumentUpload.mock.calls[1][0]);
  expect(createDocumentUpload.mock.calls[0][0]).toMatchObject({
    sha256,
    idempotencyKey: expect.any(String),
  });
});

it('restores an unresolved registration after reopening and uploads only the matching PDF', async () => {
  const firstCreate = vi.fn().mockRejectedValue({ code: 'UPLOAD_FAILED' });
  const first = setup(
    { hashPdf: vi.fn(async () => sha256), createDocumentUpload: firstCreate },
    {},
  );
  TestBed.tick();
  const file = new File(['%PDF-original'], 'procedure.pdf', { type: 'application/pdf' });
  first.facade.selectFiles([file]);
  await first.facade.submit(form);
  const frozen = firstCreate.mock.calls[0][0];
  expect(sessionStorage.getItem('barberhq:document-upload:hq:business:new')).not.toContain(
    '%PDF-original',
  );
  TestBed.resetTestingModule();

  const createDocumentUpload = vi.fn(async () => accepted);
  const uploadPdf = vi.fn(async () => accepted);
  const second = setup({ hashPdf: vi.fn(async () => sha256), createDocumentUpload, uploadPdf }, {});
  TestBed.tick();
  expect(second.facade.unknownRegistration()).toBe(true);
  expect(second.facade.recoveredRegistration()?.title).toBe(frozen.title);
  second.facade.selectFiles([file]);
  await second.facade.submit(form);
  expect(createDocumentUpload).toHaveBeenCalledWith(frozen);
  expect(uploadPdf).toHaveBeenCalledWith(accepted.versionId, file, expect.any(AbortSignal));
});

it('keeps an unknown replacement scoped to its logical document across other targets and reopen', async () => {
  const targetA = { documentId: 'DOC-A', documentRevision: 4, title: 'Guide A', version: 'v2' };
  const targetB = { documentId: 'DOC-B', documentRevision: 9, title: 'Guide B', version: 'v5' };
  const fileA = new File(['%PDF-A'], 'guide-a.pdf', { type: 'application/pdf' });
  const fileB = new File(['%PDF-B'], 'guide-b.pdf', { type: 'application/pdf' });
  const createA = vi.fn().mockRejectedValue({ code: 'UPLOAD_FAILED' });
  const firstA = setup(
    { hashPdf: vi.fn(async () => sha256), createDocumentUpload: createA },
    { replaceTarget: targetA },
  );
  TestBed.tick();
  firstA.facade.selectFiles([fileA]);
  await firstA.facade.submit({ ...form, title: 'Frozen Guide A' });
  const frozenA = createA.mock.calls[0][0];
  const storageA = 'barberhq:document-upload:hq:business:replace:DOC-A';
  expect(sessionStorage.getItem(storageA)).toBe(JSON.stringify(frozenA));
  TestBed.resetTestingModule();

  const createBWithSameFile = vi.fn(async (_input: CreateDocumentInput) => accepted);
  const secondB = setup(
    {
      hashPdf: vi.fn(async () => sha256),
      createDocumentUpload: createBWithSameFile,
      uploadPdf: vi.fn(async () => accepted),
    },
    { replaceTarget: targetB },
  );
  TestBed.tick();
  expect(secondB.facade.unknownRegistration()).toBe(false);
  secondB.facade.selectFiles([fileA]);
  await secondB.facade.submit(form);
  expect(createBWithSameFile).toHaveBeenCalledWith(
    expect.objectContaining({ documentId: 'DOC-B', expectedDocumentRevision: 9, sha256 }),
  );
  expect(createBWithSameFile.mock.calls[0][0].idempotencyKey).not.toBe(frozenA.idempotencyKey);
  expect(sessionStorage.getItem(storageA)).toBe(JSON.stringify(frozenA));
  TestBed.resetTestingModule();

  const createBWithDifferentFile = vi.fn(async (_input: CreateDocumentInput) => accepted);
  const thirdB = setup(
    {
      hashPdf: vi.fn(async (file: File) => (file.name === fileB.name ? 'd'.repeat(64) : sha256)),
      createDocumentUpload: createBWithDifferentFile,
      uploadPdf: vi.fn(async () => accepted),
    },
    { replaceTarget: targetB },
  );
  TestBed.tick();
  thirdB.facade.selectFiles([fileB]);
  await thirdB.facade.submit(form);
  expect(createBWithDifferentFile).toHaveBeenCalledWith(
    expect.objectContaining({
      documentId: 'DOC-B',
      expectedDocumentRevision: 9,
      sha256: 'd'.repeat(64),
    }),
  );
  expect(sessionStorage.getItem(storageA)).toBe(JSON.stringify(frozenA));
  TestBed.resetTestingModule();

  const createARetry = vi.fn(async () => accepted);
  const reopenedA = setup(
    {
      hashPdf: vi.fn(async () => sha256),
      createDocumentUpload: createARetry,
      uploadPdf: vi.fn(async () => accepted),
    },
    { replaceTarget: targetA },
  );
  TestBed.tick();
  expect(reopenedA.facade.unknownRegistration()).toBe(true);
  expect(reopenedA.facade.recoveredRegistration()?.title).toBe('Frozen Guide A');
  reopenedA.facade.selectFiles([fileA]);
  await reopenedA.facade.submit(form);
  expect(createARetry).toHaveBeenCalledWith(frozenA);
});

it('requires public provenance for every document kind and sends independent canonical fields', async () => {
  let sent: unknown;
  const { facade } = setup(
    {
      hashPdf: async () => sha256,
      createDocumentUpload: async (input: unknown) => {
        sent = input;
        return accepted;
      },
      uploadPdf: async () => accepted,
    },
    {},
  );
  TestBed.tick();
  facade.selectFiles([new File(['pdf'], 'guide.pdf', { type: 'application/pdf' })]);
  for (const kind of ['procedure', 'policy', 'product-card', 'product-catalog'] as const) {
    await facade.submit({
      ...form,
      kind,
      origin: 'public-compilation',
      sourceUrls: '',
      observedOn: '',
    });
    expect(facade.error()).toEqual({ key: 'procedures.upload.errors.publicSources' });
    expect(sent).toBeUndefined();
  }
  await facade.submit({ ...form, kind: 'product-card', origin: 'synthetic' });
  expect(sent).toMatchObject({ kind: 'product-card', origin: 'synthetic' });
  expect(sent).not.toHaveProperty('sourceType');
});

it('retries an unresolved pre-upgrade legacy body exactly without upgrading its identity', async () => {
  const legacy = {
    title: 'Old unresolved upload',
    language: 'en',
    sourceType: 'synthetic-procedure',
    sourceUrls: [],
    observedOn: null,
    sha256,
    idempotencyKey: '00000000-0000-4000-8000-000000000001',
  };
  sessionStorage.setItem('barberhq:document-upload:hq:business:new', JSON.stringify(legacy));
  let sent: unknown;
  const { facade } = setup(
    {
      hashPdf: async () => sha256,
      createDocumentUpload: async (input: unknown) => {
        sent = input;
        return accepted;
      },
      uploadPdf: async () => accepted,
    },
    {},
  );
  TestBed.tick();
  expect(facade.unknownRegistration()).toBe(true);
  facade.selectFiles([new File(['pdf'], 'original.pdf', { type: 'application/pdf' })]);
  await facade.submit({ ...form, kind: 'policy', origin: 'official' });
  expect(sent).toEqual(legacy);
  expect(sent).not.toHaveProperty('kind');
});
