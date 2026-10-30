import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { it, expect, vi } from 'vitest';
import { ProductKnowledgeReviewFacade } from './product-knowledge-review.facade';
import { KnowledgeApi } from '../../../core/knowledge-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import type { KnowledgeProductWorkspace } from '../../../../../../shared/contracts/product-knowledge/index';
const workspace = (): KnowledgeProductWorkspace => ({
  catalog: [],
  passages: [],
  readOnly: false,
  review: {
    versionId: 'v',
    extractionHash: 'a'.repeat(64),
    revision: 1,
    catalogRevision: 1,
    links: [],
    profiles: [],
    unlinkedPassages: [],
    impact: [],
    reviewedHash: null,
    acknowledgedUnlinkedPassages: [],
    emptyKnowledgeAcknowledged: true,
  },
});
function setup() {
  const state = signal({
    status: 'READY',
    membership: { userId: 'hq', businessId: 'b', role: 'HQ', salonIds: [] as string[] },
  });
  const currentWorkspace = signal<{ kind: 'HQ' | 'SALON' }>({ kind: 'HQ' });
  const api = { getProductKnowledge: vi.fn(async () => workspace()) };
  TestBed.configureTestingModule({
    providers: [
      ProductKnowledgeReviewFacade,
      { provide: KnowledgeApi, useValue: api },
      { provide: SessionFacade, useValue: { state } },
      { provide: SalonContext, useValue: { workspace: currentWorkspace } },
    ],
  });
  const facade = TestBed.inject(ProductKnowledgeReviewFacade);
  TestBed.tick();
  return { facade, state, currentWorkspace, api };
}
it('clears unpublished knowledge when the same account loses its HQ role', async () => {
  const h = setup();
  await h.facade.open('v');
  expect(h.facade.review()).not.toBeNull();
  h.state.update((s) => ({ ...s, membership: { ...s.membership, role: 'SALON' } }));
  TestBed.tick();
  expect(h.facade.review()).toBeNull();
});
it('discards a pending read after the workspace changes', async () => {
  const h = setup();
  let resolve: (value: KnowledgeProductWorkspace) => void = () => {};
  h.api.getProductKnowledge.mockImplementation(() => new Promise((r) => (resolve = r)));
  const pending = h.facade.open('v');
  h.currentWorkspace.set({ kind: 'SALON' });
  TestBed.tick();
  resolve(workspace());
  await pending;
  expect(h.facade.review()).toBeNull();
});
it('removes displaced profiles when correcting a link and keeps profiles supported by another confirmed link', async () => {
  const h = setup();
  await h.facade.open('v');
  const data = workspace();
  data.review.links = [
    {
      id: 'l',
      passage: { chunkId: 'c', start: 0, end: 1 },
      productId: 'a',
      method: 'hq',
      confirmed: true,
    },
  ];
  data.review.profiles = [{ productId: 'a', type: 'type A', aliases: [] }];
  h.facade.workspace.set(data);
  h.facade.changeLink('l', 'b', false);
  h.facade.changeLink('l', 'b', true);
  expect(h.facade.review()?.profiles).toEqual([]);
  expect(h.facade.confirmedProducts()).toEqual(['b']);
  const retained = workspace();
  retained.review.links = [...data.review.links, { ...data.review.links[0], id: 'second' }];
  retained.review.profiles = data.review.profiles;
  h.facade.workspace.set(retained);
  h.facade.changeLink('l', 'b', true);
  expect(h.facade.review()?.profiles).toHaveLength(1);
});
it('preserves unsaved edits when only the catalog changed and can save them against the refreshed base', async () => {
  const h = setup();
  await h.facade.open('v');
  h.facade.setType('p', 'Unsaved manual edit');
  const fresh = workspace();
  fresh.review.catalogRevision = 2;
  h.api.getProductKnowledge.mockResolvedValue(fresh);
  const save = vi
    .fn()
    .mockRejectedValueOnce({ code: 'STALE_STATE' })
    .mockImplementationOnce(async (input) => ({
      ...fresh.review,
      profiles: input.profiles,
      revision: 2,
    }));
  Object.assign(h.api, { saveKnowledgeProductReview: save });
  await h.facade.save();
  expect(h.facade.review()?.profiles[0]?.type).toBe('Unsaved manual edit');
  expect(h.facade.dirty()).toBe(true);
  await h.facade.save();
  expect(save.mock.calls[1][0].profiles[0].type).toBe('Unsaved manual edit');
  expect(h.facade.dirty()).toBe(false);
});
it('retains local work after a competing draft save and offers an explicit discard and reload', async () => {
  const h = setup();
  await h.facade.open('v');
  h.facade.setType('p', 'Unsaved manual edit');
  const fresh = workspace();
  fresh.review.revision = 2;
  h.api.getProductKnowledge.mockResolvedValue(fresh);
  Object.assign(h.api, {
    saveKnowledgeProductReview: vi.fn().mockRejectedValue({ code: 'STALE_STATE' }),
  });
  await h.facade.save();
  expect(h.facade.error()).toEqual({ key: 'procedures.product.errors.reviewChanged' });
  expect(h.facade.review()?.profiles[0]?.type).toBe('Unsaved manual edit');
  await h.facade.refresh();
  expect(h.facade.review()?.revision).toBe(2);
  expect(h.facade.dirty()).toBe(false);
});
