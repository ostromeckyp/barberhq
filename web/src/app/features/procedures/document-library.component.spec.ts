import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { DocumentRow } from '../../../../../shared/contracts/knowledge/index';
import type { TranslatedText } from '../../core/models/translated-text';
import { DocumentLibraryComponent } from './document-library.component';
import { DocumentLibraryFacade } from './library/document-library.facade';

const published: DocumentRow = {
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
  pageCount: 1,
  documentRevision: 2,
  versionRevision: 1,
  status: 'READY',
  retryable: false,
  revokedAt: null,
  createdAt: '2026-10-19T00:00:00Z',
  pdfSha256: 'a'.repeat(64),
  publishedAt: '2026-10-18T00:00:00Z',
  pendingStage: null,
};
const failed: DocumentRow = {
  ...published,
  documentId: 'DOC-2',
  versionId: 'DOC-2:v1',
  title: 'Failed guide',
  publishedAt: null,
  status: 'FAILED',
  retryable: true,
};
const withdrawn: DocumentRow = {
  ...published,
  documentId: 'DOC-3',
  versionId: 'DOC-3:v1',
  title: 'Withdrawn guide',
  publishedAt: null,
  revokedAt: '2026-10-19T00:00:00Z',
};

it('shows a salon the published PDF action without HQ management controls', async () => {
  const facade = {
    rows: signal([published]),
    nextOffset: signal(null),
    offset: signal(0),
    loading: signal(false),
    error: signal<TranslatedText | null>(null),
    busyVersion: signal(null),
    notice: signal<TranslatedText | null>(null),
    isHqWorkspace: signal(false),
    isSalonWorkspace: signal(true),
    hasMore: signal(false),
    refresh: vi.fn(),
    previous: vi.fn(),
    next: vi.fn(),
    retry: vi.fn(),
    withdraw: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [DocumentLibraryComponent],
    providers: [
      { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(DocumentLibraryComponent, {
    set: { providers: [{ provide: DocumentLibraryFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(DocumentLibraryComponent);
  await fixture.whenStable();
  const labels = fixture.nativeElement.textContent as string;
  expect(labels).toContain('Open PDF');
  const metadata = fixture.nativeElement.querySelector('dl')?.textContent ?? '';
  expect(metadata).toContain('Pages1');
  expect(metadata).toContain('Versionv1');
  expect(metadata).toContain('18 Oct 2026');
  expect(labels).not.toContain('Add document');
  expect(labels).not.toContain('Review and publish');
  expect(labels).not.toContain('Retry processing');
  expect(labels).not.toContain('Withdraw');
});

it('offers replacement for failed and withdrawn logical documents with shared desktop columns', async () => {
  const open = vi.fn(() => ({ afterClosed: () => of(undefined) }));
  const facade = {
    rows: signal([published, failed, withdrawn]),
    nextOffset: signal(null),
    offset: signal(0),
    loading: signal(false),
    error: signal<TranslatedText | null>(null),
    busyVersion: signal(null),
    notice: signal<TranslatedText | null>(null),
    isHqWorkspace: signal(true),
    isSalonWorkspace: signal(false),
    hasMore: signal(false),
    refresh: vi.fn(),
    previous: vi.fn(),
    next: vi.fn(),
    retry: vi.fn(),
    withdraw: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [DocumentLibraryComponent],
    providers: [
      { provide: MatDialog, useValue: { open } },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(DocumentLibraryComponent, {
    set: { providers: [{ provide: DocumentLibraryFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(DocumentLibraryComponent);
  await fixture.whenStable();
  const rows = Array.from<HTMLElement>(
    fixture.nativeElement.querySelectorAll('app-document-row article.document-row'),
  );
  expect(rows).toHaveLength(3);
  const actionGroups = rows.map((row) => row.querySelector('.actions')?.textContent ?? '');
  expect(actionGroups[0]).toContain('Open PDF');
  expect(actionGroups[0]).toContain('Replace PDF');
  expect(actionGroups[0]).toContain('Withdraw');
  expect(actionGroups[1]).toContain('Retry processing');
  expect(actionGroups[1]).toContain('Replace PDF');
  expect(actionGroups[2]).toContain('Replace PDF');
  expect(rows.every((row) => row.parentElement?.parentElement?.classList.contains('list'))).toBe(
    true,
  );
  Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
    .find((button) => button.textContent?.includes('Add document'))!
    .click();
  expect(open).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ data: {} }));
  const replaceButtons = Array.from<HTMLButtonElement>(
    fixture.nativeElement.querySelectorAll('button'),
  ).filter((button) => button.textContent?.includes('Replace PDF'));
  expect(replaceButtons).toHaveLength(3);
  replaceButtons[1].click();
  expect(open).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      data: {
        replaceTarget: {
          documentId: failed.documentId,
          documentRevision: failed.documentRevision,
          title: failed.title,
          version: failed.version,
          kind: failed.kind,
          origin: failed.origin,
          language: failed.language,
          sourceUrls: failed.sourceUrls,
          observedOn: failed.observedOn,
        },
      },
    }),
  );
});
