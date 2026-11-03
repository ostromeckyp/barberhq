import { signal } from '@angular/core';
import { ClientLog } from '../../../core/client-log';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { it, expect, vi } from 'vitest';
import type { DeliveryIssueDto } from '../../../../../../shared/contracts/delivery/index';
import type { SessionState } from '../../../../../../shared/contracts/business/index';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext, type Workspace } from '../../../core/salon-context';
import { DeliveryApi } from '../data-access/delivery-api';
import { DELIVERY_JOURNAL, DeliveryJournal } from './delivery-journal';
import { DeliveryIssueFacade } from './delivery-issue.facade';
const member = { userId: 'one', businessId: 'business', role: 'HQ' as const, salonIds: ['salon'] };
const issue: DeliveryIssueDto = {
  id: 'issue',
  rootRequestId: 'request',
  salonId: 'salon',
  salonName: 'Salon',
  status: 'OPEN',
  revision: 1,
  createdAt: 'now',
  items: [
    {
      productId: 'product',
      productName: 'Product',
      initialAffectedQuantity: 2,
      replacementAcceptedQuantity: 0,
      outstandingQuantity: 2,
    },
  ],
  rootReceipt: {
    id: 'receipt',
    requestId: 'request',
    recordedAt: 'now',
    actorLabel: 'requests.actor.recipient',
    origin: 'RECORDED',
    items: [
      {
        productId: 'product',
        productName: 'Product',
        goodQuantity: 8,
        damagedQuantity: 2,
        missingQuantity: 0,
      },
    ],
    report: { description: 'Broken', batchIdentifier: null },
    procedureReferences: [],
    rootIssueId: 'issue',
    legacyActionReceiptId: null,
  },
  activeReplacement: null,
  replacements: [],
  replacementOffset: 0,
  hasMoreReplacements: false,
  events: [],
  eventOffset: 0,
  hasMoreEvents: false,
};
async function settle() {
  TestBed.flushEffects();
  await new Promise((r) => setTimeout(r, 0));
  TestBed.flushEffects();
}
async function setup(run: () => Promise<unknown>, mode: 'HQ' | 'SALON' = 'HQ') {
  const state = signal<SessionState>({ status: 'READY', membership: member }),
    workspace = signal<Workspace>(
      mode === 'HQ' ? { kind: 'HQ' } : { kind: 'SALON', salonId: 'salon' },
    );
  const data = new Map<string, string>();
  const journal = new DeliveryJournal({
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
    keys: () => [...data.keys()],
  });
  const addNote = vi.fn(run),
    createReplacement = vi.fn(run),
    startReview = vi.fn(run),
    getIssue = vi.fn(async () => structuredClone(issue));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      DeliveryIssueFacade,
      { provide: SessionFacade, useValue: { state } },
      { provide: SalonContext, useValue: { workspace } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(
            convertToParamMap({
              issueId: 'issue',
              ...(mode === 'SALON' ? { salonId: 'salon' } : {}),
            }),
          ),
          queryParamMap: of(convertToParamMap({})),
          snapshot: { data: { workspace: mode } },
        },
      },
      {
        provide: DeliveryApi,
        useValue: {
          getIssue,
          addNote,
          createReplacement,
          startReview,
          getProcedures: async () => [],
        },
      },
      { provide: DELIVERY_JOURNAL, useValue: journal },
    ],
  });
  const facade = TestBed.inject(DeliveryIssueFacade);
  await settle();
  return { facade, state, workspace, journal, addNote, createReplacement, getIssue };
}
it('keeps an unknown note immutable and retries the original key after edits', async () => {
  let calls = 0;
  const h = await setup(async () => {
    if (++calls === 1) throw { code: 'UNKNOWN' };
    return { commandId: 'saved', replayed: true };
  });
  h.facade.draft.note.set('Warehouse arranged');
  await h.facade.act('ADD_NOTE');
  expect(h.facade.unknown()).toBe(true);
  h.facade.draft.note.set('Attempted change');
  await h.facade.retry();
  expect(h.addNote.mock.calls[1]).toEqual(h.addNote.mock.calls[0]);
  expect(h.facade.unknown()).toBe(false);
});
it('never offers or replays an HQ command in salon workspace, even for HQ membership', async () => {
  const h = await setup(async () => ({ commandId: 'bad' }), 'SALON');
  expect(h.facade.canCreate()).toBe(false);
  expect(h.facade.canReview()).toBe(false);
  await h.facade.act('CREATE_REPLACEMENT');
  expect(h.createReplacement).not.toHaveBeenCalled();
});
it('retains an unsent note during transient auth failure and clears it after a verified workspace switch', async () => {
  const h = await setup(async () => ({ commandId: 'saved' }));
  h.facade.draft.note.set('Keep for PDF return');
  h.state.set({ status: 'ERROR' });
  await settle();
  expect(h.facade.draft.note()).toBe('Keep for PDF return');
  await h.facade.act('ADD_NOTE');
  expect(h.addNote).not.toHaveBeenCalled();
  h.state.set({ status: 'READY', membership: member });
  h.workspace.set({ kind: 'SALON', salonId: 'salon' });
  await settle();
  expect(h.facade.draft.note()).toBe('');
});
it('keeps a definitive active-order conflict open and refreshes facts without inventing a child', async () => {
  const h = await setup(async () => {
    throw { code: 'ALREADY_ACTIVE', message: 'An active order exists' };
  });
  await h.facade.act('CREATE_REPLACEMENT');
  await settle();
  expect(h.facade.unknown()).toBe(false);
  expect(h.facade.issue()?.status).toBe('OPEN');
  expect(h.facade.issue()?.replacements).toEqual([]);
  expect(h.getIssue).toHaveBeenCalledTimes(2);
});

it('preserves an unknown HQ action when access is denied before replay lookup', async () => {
  let attempt = 0;
  const h = await setup(async () => {
    throw { code: ++attempt === 1 ? 'UNKNOWN' : 'FORBIDDEN' };
  });
  h.facade.draft.note.set('Replacement arranged');
  await h.facade.act('ADD_NOTE');
  const frozen = h.facade.pending();
  await h.facade.retry();
  expect(h.journal.load({ ...member, salonId: 'salon', targetId: 'issue' })).toEqual(frozen);
  expect(h.facade.pending()).toEqual(frozen);
  await h.facade.retry();
  expect(h.addNote).toHaveBeenCalledTimes(2);
});

it('logs the load', async () => {
  const record = vi.spyOn(ClientLog.prototype, 'record');
  await setup(async () => ({}));
  expect(record).toHaveBeenCalledWith('delivery.issue.load', 'ok', expect.anything());
  record.mockRestore();
});
