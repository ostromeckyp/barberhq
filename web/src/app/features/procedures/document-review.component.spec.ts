import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import type {
  DocumentRow,
  ExtractedPage,
  KnowledgeReview,
  VersionStatus,
} from '../../../../../shared/contracts/knowledge';
import { KnowledgeApi } from '../../core/knowledge-api';
import { SalonContext } from '../../core/salon-context';
import { SessionFacade } from '../auth/feature/session.facade';
import { DocumentReviewComponent } from './document-review.component';
import { DocumentReviewFacade } from './library/document-review.facade';
import { ProductKnowledgeReviewFacade } from './library/product-knowledge-review.facade';
import { DOCUMENT_PDF_RENDERER } from './library/document-review-renderer';

const page = (physicalPage: number): ExtractedPage & { reviewed: boolean } => ({
  physicalPage,
  text: `Extracted text for page ${physicalPage}`,
  markdown: `Extracted text for page ${physicalPage}`,
  spans: [],
  quality: 'COMPLETE',
  reviewed: true,
  viewBox: [0, 0, 612, 792],
  userUnit: 1,
  rotation: 0,
});
const version = (documentRevision = 2): DocumentRow => ({
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
  pageCount: 2,
  documentRevision,
  versionRevision: 1,
  status: 'EXTRACTED',
  retryable: false,
  revokedAt: null,
  createdAt: '2026-10-19T00:00:00Z',
  pdfSha256: 'a'.repeat(64),
  publishedAt: null,
  pendingStage: null,
});
const review = (documentRevision = 2): KnowledgeReview => ({
  version: version(documentRevision),
  extractionHash: 'b'.repeat(64),
  pages: [page(1), page(2)],
  publicationAllowed: true,
});
const publishedReview = (): KnowledgeReview => ({
  ...review(3),
  version: {
    ...version(3),
    versionRevision: 2,
    status: 'READY',
    publishedAt: '2026-10-19T12:00:00Z',
  },
  publicationAllowed: false,
});
const accepted: VersionStatus = {
  versionId: 'DOC-1:v1',
  documentId: 'DOC-1',
  status: 'READY',
  retryable: false,
  documentRevision: 3,
  versionRevision: 2,
  revokedAt: null,
};
afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

async function setup(
  getReview = vi.fn(async () => review()),
  publish = vi.fn(async () => accepted),
  render = vi.fn(async () => ({ width: 612, height: 792, rects: [] })),
) {
  const params = new BehaviorSubject(convertToParamMap({ versionId: 'DOC-1:v1' }));
  const renderer = {
    pageCount: 2,
    open: vi.fn(async () => undefined),
    render,
    dispose: vi.fn(),
    cancelRender: vi.fn(),
  };
  const api = {
    getReview,
    getPdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
    reviewAndPublishDocument: publish,
  };
  TestBed.configureTestingModule({
    imports: [DocumentReviewComponent],
    providers: [
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: KnowledgeApi, useValue: api },
      { provide: SalonContext, useValue: { workspace: signal({ kind: 'HQ' }) } },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'hq', businessId: 'business', role: 'HQ', salonIds: [] },
          }),
        },
      },
    ],
  });
  TestBed.overrideComponent(DocumentReviewComponent, {
    set: {
      providers: [
        DocumentReviewFacade,
        ProductKnowledgeReviewFacade,
        { provide: DOCUMENT_PDF_RENDERER, useValue: renderer },
      ],
    },
  });
  const fixture = TestBed.createComponent(DocumentReviewComponent);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  return { fixture, component: fixture.componentInstance, renderer, api };
}

it('returns from review to the Documents tab using the shared Back button', async () => {
  const h = await setup();
  const back = h.fixture.nativeElement.querySelector('button.app-back-button') as HTMLButtonElement;
  expect(back).not.toBeNull();
  expect(back.textContent?.trim()).toBe('Back to documents');
  expect(back.hasAttribute('mat-stroked-button')).toBe(true);
  back.click();
  expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/procedures'], {
    queryParams: { tab: 'documents' },
  });
});

it('does not restart a deferred original-page render during an identical five-second poll', async () => {
  vi.useFakeTimers();
  let finishRender!: () => void;
  const render = vi.fn(
    () =>
      new Promise<{ width: number; height: number; rects: [] }>((resolve) => {
        finishRender = () => resolve({ width: 612, height: 792, rects: [] });
      }),
  );
  const getReview = vi.fn(async () => review());
  const h = await setup(
    getReview,
    vi.fn(async () => accepted),
    render,
  );
  expect(render).toHaveBeenCalledTimes(1);
  expect(h.component.facade.renderedPages().has(1)).toBe(false);
  await vi.advanceTimersByTimeAsync(5100);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  h.fixture.detectChanges();
  expect(getReview).toHaveBeenCalledTimes(2);
  expect(render).toHaveBeenCalledTimes(1);
  finishRender();
  await TestBed.inject(ApplicationRef).whenStable();
  h.fixture.detectChanges();
  expect(h.component.facade.renderedPages().has(1)).toBe(true);
  const checkbox = h.fixture.nativeElement.querySelector('mat-checkbox input') as HTMLInputElement;
  expect(checkbox.disabled).toBe(false);
  vi.useRealTimers();
});

it('requires a rendered and explicitly checked original for every extracted page', async () => {
  const h = await setup();
  expect(h.component.facade.checkedPages().size).toBe(0);
  expect(h.component.facade.renderedPages().has(1)).toBe(true);
  expect(h.component.facade.canPublish()).toBe(false);
  const publishButton = Array.from<HTMLButtonElement>(
    h.fixture.nativeElement.querySelectorAll('button'),
  ).find((button) => button.textContent?.includes('Publish version'))!;
  expect(publishButton.disabled).toBe(true);
  h.component.facade.togglePage(true);
  h.component.facade.pageBy(1);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  expect(h.component.facade.renderedPages().has(2)).toBe(true);
  expect(h.component.facade.canPublish()).toBe(false);
  h.component.facade.togglePage(true);
  expect(h.component.facade.canPublish()).toBe(true);
  await TestBed.inject(ApplicationRef).whenStable();
  expect(publishButton.disabled).toBe(false);
  expect(h.fixture.nativeElement.textContent).toContain('2 of 2 pages reviewed');
});

it('clears page checks and requires a fresh review after a version conflict response', async () => {
  const getReview = vi.fn().mockResolvedValueOnce(review()).mockResolvedValueOnce(review(3));
  const publish = vi.fn().mockRejectedValue({ code: 'VERSION_CONFLICT' });
  const h = await setup(getReview, publish);
  h.component.facade.togglePage(true);
  h.component.facade.pageBy(1);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  h.component.facade.togglePage(true);
  expect(h.component.facade.checkedPages().size).toBe(2);
  await h.component.facade.publish();
  expect(h.component.facade.checkedPages().size).toBe(0);
  expect(h.component.facade.error()).toContain('review every page again');
});

it('reuses the exact review command and key after an unknown publication result', async () => {
  const publish = vi
    .fn()
    .mockRejectedValueOnce({ code: 'UPLOAD_FAILED' })
    .mockResolvedValueOnce(accepted);
  const h = await setup(
    vi.fn(async () => review()),
    publish,
  );
  h.component.facade.togglePage(true);
  h.component.facade.pageBy(1);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  h.component.facade.togglePage(true);
  await h.component.facade.publish();
  expect(h.component.facade.publishLabel()).toBe('Retry same publication');
  h.fixture.detectChanges();
  expect(h.fixture.nativeElement.textContent).toContain('Retry same publication');
  await h.component.facade.publish();
  expect(publish).toHaveBeenCalledTimes(2);
  expect(publish.mock.calls[0][0]).toEqual(publish.mock.calls[1][0]);
  expect(publish.mock.calls[0][0]).toMatchObject({
    versionId: 'DOC-1:v1',
    extractionHash: 'b'.repeat(64),
    reviewedPhysicalPages: [1, 2],
    idempotencyKey: expect.any(String),
  });
});

it('restores the same frozen publication command after reopening the review route', async () => {
  const firstPublish = vi.fn().mockRejectedValue({ code: 'UPLOAD_FAILED' });
  const first = await setup(
    vi.fn(async () => review()),
    firstPublish,
  );
  first.component.facade.togglePage(true);
  first.component.facade.pageBy(1);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  first.component.facade.togglePage(true);
  await first.component.facade.publish();
  const frozen = firstPublish.mock.calls[0][0];
  first.fixture.destroy();
  TestBed.resetTestingModule();

  const secondPublish = vi.fn(async () => accepted);
  const second = await setup(
    vi.fn(async () => review()),
    secondPublish,
  );
  expect(second.component.facade.hasFrozen()).toBe(true);
  await second.component.facade.publish();
  expect(secondPublish).toHaveBeenCalledWith(frozen);
});

it('shows a published version as read-only without stale review or publication messaging', async () => {
  const getReview = vi
    .fn()
    .mockResolvedValueOnce(review())
    .mockResolvedValueOnce(publishedReview());
  const h = await setup(
    getReview,
    vi.fn(async () => accepted),
  );
  h.component.facade.togglePage(true);
  h.component.facade.pageBy(1);
  TestBed.tick();
  await TestBed.inject(ApplicationRef).whenStable();
  TestBed.tick();
  h.component.facade.togglePage(true);
  expect(h.component.facade.canPublish()).toBe(true);

  await h.component.facade.publish();
  h.fixture.detectChanges();
  const text = h.fixture.nativeElement.textContent as string;
  expect(text).toContain('Published');
  expect(text).toContain('read-only');
  expect(text).not.toContain('This version is not eligible for publication');
  expect(text).not.toContain('Publication queued');
  expect(text).not.toContain('0 of 2 pages reviewed');
  expect(h.component.facade.checkedPages().size).toBe(0);
  expect(h.fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
  expect(
    Array.from<HTMLButtonElement>(h.fixture.nativeElement.querySelectorAll('button')).some(
      (button) => button.textContent?.includes('Publish version'),
    ),
  ).toBe(false);
});

it('restores the frozen product review hash after reopening even when newer draft knowledge is loaded', async () => {
  const { ProductKnowledgeReviewFacade } =
    await import('./library/product-knowledge-review.facade');
  const productHash = signal('c'.repeat(64));
  const publish = vi
    .fn()
    .mockRejectedValueOnce({ code: 'UPLOAD_FAILED' })
    .mockResolvedValueOnce(accepted);
  async function mount() {
    TestBed.configureTestingModule({
      providers: [
        DocumentReviewFacade,
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ versionId: 'DOC-1:v1' })) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: KnowledgeApi,
          useValue: {
            getReview: vi.fn(async () => ({
              ...review(),
              version: { ...version(), kind: 'product-card' },
            })),
            getPdf: vi.fn(async () => new Uint8Array([1])),
            reviewAndPublishDocument: publish,
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
        {
          provide: ProductKnowledgeReviewFacade,
          useValue: {
            clear: vi.fn(),
            ready: () => true,
            review: () => ({ reviewedHash: productHash() }),
            workspace: () => null,
          },
        },
        {
          provide: DOCUMENT_PDF_RENDERER,
          useValue: { pageCount: 2, open: vi.fn(), dispose: vi.fn(), cancelRender: vi.fn() },
        },
      ],
    });
    const facade = TestBed.inject(DocumentReviewFacade);
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    return facade;
  }
  const first = await mount();
  first.renderedPages.set(new Set([1, 2]));
  first.checkedPages.set(new Set([1, 2]));
  await first.publish();
  const frozen = publish.mock.calls[0][0];
  expect(frozen.productKnowledgeReviewedHash).toBe('c'.repeat(64));
  TestBed.resetTestingModule();
  productHash.set('d'.repeat(64));
  const second = await mount();
  expect(second.hasFrozen()).toBe(true);
  await second.publish();
  expect(publish.mock.calls[1][0]).toEqual(frozen);
});
it('passes published product classification and provenance into the replacement dialog', async () => {
  const { MatDialog } = await import('@angular/material/dialog');
  const source = {
    ...publishedReview(),
    version: {
      ...publishedReview().version,
      kind: 'product-catalog' as const,
      origin: 'public-compilation' as const,
      language: 'pl',
      sourceUrls: ['https://example.test/catalog'],
      observedOn: '2026-10-01',
    },
  };
  const h = await setup(vi.fn(async () => source));
  const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({} as never);
  h.component.replace();
  expect(open).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      data: {
        replaceTarget: expect.objectContaining({
          kind: 'product-catalog',
          origin: 'public-compilation',
          language: 'pl',
          sourceUrls: ['https://example.test/catalog'],
          observedOn: '2026-10-01',
        }),
      },
    }),
  );
});
