import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { it, expect, vi } from 'vitest';
import { ProductKnowledgeReviewComponent } from './product-knowledge-review.component';
import { ProductKnowledgeReviewFacade } from './library/product-knowledge-review.facade';
import { KnowledgeApi } from '../../core/knowledge-api';
import { SessionFacade } from '../auth/feature/session.facade';
import type { KnowledgeProductWorkspace } from '../../../../../shared/contracts/product-knowledge';
const workspace = (): KnowledgeProductWorkspace => ({
  review: {
    versionId: 'v',
    extractionHash: 'a'.repeat(64),
    revision: 1,
    catalogRevision: 2,
    links: [
      {
        id: 'l',
        passage: { chunkId: 'c', start: 0, end: 7 },
        productId: 'p',
        method: 'code',
        confirmed: true,
      },
    ],
    profiles: [
      {
        productId: 'p',
        type: 'type X',
        aliases: [
          {
            id: 'a',
            productId: 'p',
            phrase: 'Alpha',
            kind: 'name',
            lang: 'pl',
            source: 'generated',
            decision: 'pending',
          },
        ],
      },
    ],
    unlinkedPassages: [],
    impact: [
      {
        normalized: 'alpha',
        beforeProductIds: ['other'],
        afterProductIds: ['other', 'p'],
        collision: true,
      },
    ],
    reviewedHash: null,
    acknowledgedUnlinkedPassages: [],
    emptyKnowledgeAcknowledged: false,
  },
  catalog: [
    {
      id: 'p',
      name: 'Product A',
      sourceCode: '123',
      type: 'old type',
      category: 'X',
      summaryEn: 'Facts',
      scentPl: null,
    },
  ],
  passages: [{ ref: { chunkId: 'c', start: 0, end: 7 }, text: 'Facts A', physicalPage: 2 }],
  readOnly: false,
});
async function setup() {
  const api = {
    getProductKnowledge: vi.fn(async () => workspace()),
    saveKnowledgeProductReview: vi.fn(async (input: unknown) => {
      const next = workspace().review;
      next.profiles[0].aliases[0].decision = 'accepted';
      next.revision = 2;
      return next;
    }),
    acceptKnowledgeProductReview: vi.fn(async () => ({
      ...workspace().review,
      reviewedHash: 'b'.repeat(64),
    })),
    generateKnowledgeProductAliases: vi.fn(async () => {
      throw { code: 'PROVIDER_UNAVAILABLE' };
    }),
  };
  TestBed.configureTestingModule({
    imports: [ProductKnowledgeReviewComponent],
    providers: [
      ProductKnowledgeReviewFacade,
      { provide: KnowledgeApi, useValue: api },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'hq', businessId: 'b', role: 'HQ', salonIds: [] },
          }),
        },
      },
    ],
  });
  const f = TestBed.createComponent(ProductKnowledgeReviewComponent);
  f.componentRef.setInput('versionId', 'v');
  f.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  f.detectChanges();
  return { f, api, facade: TestBed.inject(ProductKnowledgeReviewFacade) };
}
it('shows exact source page, proposal decisions, type change and distinct collision impact', async () => {
  const { f } = await setup();
  const text = f.nativeElement.textContent;
  for (const value of ['Facts A', 'page 2', 'code', 'old type', 'type X', '1 → 2'])
    expect(text).toContain(value);
  expect(
    [...f.nativeElement.querySelectorAll('input')].some((input: any) => input.value === 'Alpha'),
  ).toBe(true);
  expect(f.nativeElement.querySelector('[data-testid="accept-review"]').disabled).toBe(true);
});
it('keeps drafts when generation fails and never approves its candidates silently', async () => {
  const { f, facade } = await setup();
  await facade.generate('p');
  f.detectChanges();
  expect(facade.review()?.profiles[0].aliases[0].decision).toBe('pending');
  expect(f.nativeElement.textContent).toContain('edit manually');
});
it('makes published sources read-only and freezes draft inputs during an unknown publication', async () => {
  const { f } = await setup();
  f.componentRef.setInput('disabled', true);
  f.detectChanges();
  expect(
    [...f.nativeElement.querySelectorAll('input,textarea,select')].every((e: any) => e.disabled),
  ).toBe(true);
});
it('keeps acknowledged passages checked after SQL JSON changes object field order', async () => {
  const { f, facade } = await setup();
  const next = workspace();
  next.review.unlinkedPassages = [{ chunkId: 'c', start: 1, end: 3 }];
  next.review.acknowledgedUnlinkedPassages = [{ end: 3, start: 1, chunkId: 'c' }];
  facade.workspace.set(next);
  f.detectChanges();
  const checkbox = [...f.nativeElement.querySelectorAll('mat-checkbox')].find((e: any) =>
    e.textContent.includes('Leave this passage unlinked'),
  ) as HTMLElement;
  expect((checkbox.querySelector('input') as HTMLInputElement).checked).toBe(true);
});
it('offers an enabled explicit discard and reload after a competing review edit', async () => {
  const { f, facade, api } = await setup();
  facade.setType('p', 'Unsaved');
  api.saveKnowledgeProductReview.mockRejectedValueOnce({ code: 'STALE_STATE' });
  const next = workspace();
  next.review.revision = 99;
  api.getProductKnowledge.mockResolvedValue(next);
  await facade.save();
  f.detectChanges();
  const reload = [...f.nativeElement.querySelectorAll('button')].find(
    (b: any) => b.textContent.includes('Reload') && b.textContent.includes('discard'),
  ) as HTMLButtonElement;
  expect(reload).toBeDefined();
  expect(reload.disabled).toBe(false);
});
