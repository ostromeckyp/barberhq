import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { it, expect, vi } from 'vitest';
import type { SessionState } from '../../../../../../shared/contracts/business';
import type {
  DeliveryReceiptContextDto,
  RecordDeliveryInput,
} from '../../../../../../shared/contracts/delivery';
import { SessionFacade } from '../../auth/feature/session.facade';
import { SalonContext } from '../../../core/salon-context';
import { DeliveryApi } from '../data-access/delivery-api';
import { DELIVERY_JOURNAL, DeliveryJournal } from './delivery-journal';
import { DeliveryReceiptFacade } from './delivery-receipt.facade';
import { DeliveryReceiptComponent } from '../ui/delivery-receipt.component';
import { runtimeConfig } from '../../../core/public-config';
import type { PublicConfig } from '../../../../../../scripts/config/public-config';
const member = {
  userId: 'one',
  businessId: 'business',
  role: 'SALON' as const,
  salonIds: ['salon'],
};
const context: DeliveryReceiptContextDto = {
  request: {
    id: 'request',
    salonId: 'salon',
    salonName: 'Salon',
    revision: 3,
    state: 'DISPATCHED',
    items: [
      {
        productId: 'product',
        productName: 'Product',
        quantity: 10,
        dispatchedQuantity: 10,
        receivedQuantity: 0,
        stock: {
          productId: 'product',
          productName: 'Product',
          demoId: 'product',
          netContent: { value: 100, unit: 'ml' },
          salonId: 'salon',
          salonOnHand: 2,
          hqOnHand: 8,
          hqReserved: 0,
          hqAvailable: 8,
          hqInventoryVersion: 3,
          salonInventoryVersion: 1,
        },
      },
    ],
    timeline: [],
    itemCount: 1,
    totalUnits: 10,
    createdAt: 'now',
  },
  summary: { receipt: null, rootIssue: null, replacementForIssueId: null, items: [] },
  procedures: (['DAMAGED', 'MISSING'] as const).map((kind) => ({
    kind,
    documentId: null,
    revision: 0,
    availability: 'MISSING',
    reference: null,
    title: null,
  })),
};
async function setup(command: (input: RecordDeliveryInput) => Promise<unknown>) {
  const state = signal<SessionState>({ status: 'READY', membership: member }),
    workspace = signal({ kind: 'SALON' as const, salonId: 'salon' }),
    data = new Map<string, string>();
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
  const recordReceipt = vi.fn(command),
    getReceiptContext = vi.fn(async () => structuredClone(context));
  TestBed.configureTestingModule({
    imports: [DeliveryReceiptComponent],
    providers: [
      provideRouter([]),
      DeliveryReceiptFacade,
      { provide: SessionFacade, useValue: { state } },
      { provide: SalonContext, useValue: { workspace } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ salonId: 'salon', requestId: 'request' })),
          queryParamMap: of(convertToParamMap({})),
        },
      },
      { provide: DeliveryApi, useValue: { getReceiptContext, recordReceipt } },
      { provide: DELIVERY_JOURNAL, useValue: journal },
    ],
  });
  const facade = TestBed.inject(DeliveryReceiptFacade);
  await settle();
  return { facade, state, workspace, journal, recordReceipt, getReceiptContext };
}
async function settle() {
  TestBed.flushEffects();
  await new Promise((r) => setTimeout(r, 0));
  TestBed.flushEffects();
}
function fill(f: DeliveryReceiptFacade) {
  f.draft.model.update((v) => ({
    ...v,
    items: [{ productId: 'product', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 }],
    description: 'Two cracked jars',
    batchIdentifier: 'LOT-42',
  }));
}
it('freezes unknown input across edits and retries the same key, clearing only after a known result', async () => {
  let calls = 0;
  const h = await setup(async () => {
    if (++calls === 1) throw { code: 'UNKNOWN' };
    return { commandId: 'command', replayed: true };
  });
  fill(h.facade);
  await h.facade.submit();
  expect(h.facade.unknown()).toBe(true);
  const first = h.recordReceipt.mock.calls[0][0];
  expect(Object.isFrozen(first.items[0])).toBe(true);
  h.facade.draft.model.update((v) => ({ ...v, description: 'attempted edit' }));
  await h.facade.submit();
  expect(h.recordReceipt.mock.calls[1][0]).toEqual(first);
  expect(h.facade.result()?.commandId).toBe('command');
  expect(
    h.journal.load({
      userId: 'one',
      businessId: 'business',
      salonId: 'salon',
      targetId: 'request',
    }),
  ).toBeNull();
});

it('offers a relevant editable question without losing the inspection draft or showing duplicate assignment notices', async () => {
  const previous = runtimeConfig.publicConfig;
  runtimeConfig.publicConfig = { knowledgeEnabled: true, ragEnabled: true } as PublicConfig;
  try {
    const h = await setup(async () => ({ commandId: 'command' }));
    const fixture = TestBed.createComponent(DeliveryReceiptComponent);
    fixture.detectChanges();
    await settle();
    fill(h.facade);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain(
      'Check your salon procedure before handling damaged or missing products.',
    );
    expect(root.textContent).not.toContain('procedure is not assigned');
    const prompt = [...root.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('W dostawie są uszkodzone produkty.'),
    );
    expect(prompt).toBeDefined();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    prompt!.click();
    expect(navigate).toHaveBeenCalledWith(['/procedures'], {
      queryParams: expect.objectContaining({
        tab: 'assistant',
        deliveryProblem: 'DAMAGED',
        returnTo: 'delivery-receipt',
        salonId: 'salon',
        requestId: 'request',
      }),
    });
    expect(h.facade.draft.model().description).toBe('Two cracked jars');
    expect(h.recordReceipt).not.toHaveBeenCalled();
    h.facade.draft.model.update((v) => ({
      ...v,
      items: [{ productId: 'product', goodQuantity: 8, damagedQuantity: 0, missingQuantity: 2 }],
    }));
    fixture.detectChanges();
    expect(root.textContent).toContain('W dostawie brakuje produktów.');
    h.facade.draft.model.update((v) => ({
      ...v,
      items: [{ productId: 'product', goodQuantity: 8, damagedQuantity: 1, missingQuantity: 1 }],
    }));
    fixture.detectChanges();
    expect(root.textContent).toContain(
      'W dostawie są uszkodzone produkty i brakuje części produktów.',
    );
    h.facade.draft.model.update((v) => ({
      ...v,
      items: [{ productId: 'product', goodQuantity: 10, damagedQuantity: 0, missingQuantity: 0 }],
    }));
    fixture.detectChanges();
    expect(root.textContent).not.toContain('Jak postąpić zgodnie z procedurą?');
  } finally {
    runtimeConfig.publicConfig = previous;
  }
});

it('marks every dispatched product as good without submitting or discarding the report, and refuses edits while locked', async () => {
  const h = await setup(async () => {
    throw { code: 'UNKNOWN' };
  });
  const twoProducts = structuredClone(context);
  twoProducts.request.items.push({
    ...twoProducts.request.items[0],
    productId: 'other',
    productName: 'Other',
    quantity: 6,
    dispatchedQuantity: 6,
  });
  h.getReceiptContext.mockResolvedValue(twoProducts);
  h.facade.refresh();
  await settle();
  const fixture = TestBed.createComponent(DeliveryReceiptComponent);
  fixture.detectChanges();
  await settle();
  h.facade.draft.model.update((v) => ({
    ...v,
    items: [
      { productId: 'product', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
      { productId: 'other', goodQuantity: 5, damagedQuantity: 0, missingQuantity: 1 },
    ],
    description: 'Report kept',
    batchIdentifier: 'LOT-42',
  }));
  fixture.detectChanges();
  const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Mark all as good'),
  );
  expect(button).toBeDefined();
  button!.click();
  fixture.detectChanges();
  expect(h.facade.draft.model()).toMatchObject({
    items: [
      { productId: 'product', goodQuantity: 10, damagedQuantity: 0, missingQuantity: 0 },
      { productId: 'other', goodQuantity: 6, damagedQuantity: 0, missingQuantity: 0 },
    ],
    description: 'Report kept',
    batchIdentifier: 'LOT-42',
  });
  expect(h.recordReceipt).not.toHaveBeenCalled();
  const componentFacade = fixture.componentInstance.facade;
  await componentFacade.submit();
  expect(componentFacade.unknown()).toBe(true);
  const frozen = JSON.stringify(componentFacade.draft.model());
  fixture.detectChanges();
  expect(button!.disabled).toBe(true);
  button!.click();
  expect(JSON.stringify(componentFacade.draft.model())).toBe(frozen);
});

it('keeps quantities labelled by product when a refreshed request returns items in a different order', async () => {
  const h = await setup(async () => ({ commandId: 'command' }));
  const multiple = structuredClone(context);
  multiple.request.items.push({
    ...multiple.request.items[0],
    productId: 'other',
    productName: 'Other',
    quantity: 6,
    dispatchedQuantity: 6,
  });
  h.getReceiptContext.mockResolvedValue(multiple);
  const fixture = TestBed.createComponent(DeliveryReceiptComponent);
  fixture.detectChanges();
  await settle();
  h.facade.draft.model.update((v) => ({
    ...v,
    items: [
      { productId: 'product', goodQuantity: 8, damagedQuantity: 2, missingQuantity: 0 },
      { productId: 'other', goodQuantity: 5, damagedQuantity: 0, missingQuantity: 1 },
    ],
  }));
  fixture.detectChanges();
  h.getReceiptContext.mockResolvedValue({
    ...multiple,
    request: { ...multiple.request, items: [...multiple.request.items].reverse() },
  });
  fixture.componentInstance.facade.refresh();
  await settle();
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelector<HTMLInputElement>('[aria-label="Good units · Product"]')?.value).toBe(
    '8',
  );
  expect(
    root.querySelector<HTMLInputElement>('[aria-label="Damaged units · Product"]')?.value,
  ).toBe('2');
  expect(root.querySelector<HTMLInputElement>('[aria-label="Good units · Other"]')?.value).toBe(
    '5',
  );
  expect(root.querySelector<HTMLInputElement>('[aria-label="Missing units · Other"]')?.value).toBe(
    '1',
  );
  expect(h.recordReceipt).not.toHaveBeenCalled();
});
it('preserves a withdrawn source and all fields after definitive SOURCE_CHANGED, allowing explicit removal', async () => {
  const h = await setup(async () => {
    throw { code: 'SOURCE_CHANGED', message: 'Source changed' };
  });
  fill(h.facade);
  h.facade.draft.model.update((v) => ({
    ...v,
    procedureReferences: [{ kind: 'DAMAGED', versionId: 'withdrawn' }],
  }));
  await h.facade.submit();
  await settle();
  expect(h.facade.unknown()).toBe(false);
  expect(h.facade.draft.model().description).toBe('Two cracked jars');
  expect(h.facade.draft.model().procedureReferences).toHaveLength(1);
  h.facade.removeReference('DAMAGED');
  expect(h.facade.draft.model().procedureReferences).toEqual([]);
  expect(h.getReceiptContext).toHaveBeenCalledTimes(2);
});
it('blocks a submission during a transient auth error without losing the unsent draft', async () => {
  const h = await setup(async () => ({ commandId: 'command' }));
  fill(h.facade);
  h.state.set({ status: 'ERROR' });
  await settle();
  await h.facade.submit();
  expect(h.recordReceipt).not.toHaveBeenCalled();
  expect(h.facade.draft.model().description).toBe('Two cracked jars');
});
it('retains an unknown original journal across a verified account change without displaying or replaying it', async () => {
  const h = await setup(async () => {
    throw { code: 'UNKNOWN' };
  });
  fill(h.facade);
  await h.facade.submit();
  h.state.set({ status: 'READY', membership: { ...member, userId: 'two' } });
  await settle();
  await h.facade.submit();
  expect(h.recordReceipt).toHaveBeenCalledTimes(1);
  expect(h.facade.draft.model().description).toBe('');
  expect(h.journal.load({ ...member, salonId: 'salon', targetId: 'request' })).not.toBeNull();
});

it('preserves a committed inspection key when replay is denied before key lookup', async () => {
  let attempt = 0;
  const h = await setup(async () => {
    throw { code: ++attempt === 1 ? 'UNKNOWN' : 'FORBIDDEN' };
  });
  fill(h.facade);
  await h.facade.submit();
  const frozen = h.recordReceipt.mock.calls[0][0];
  await h.facade.submit();
  expect(h.journal.load({ ...member, salonId: 'salon', targetId: 'request' })?.input).toEqual(
    frozen,
  );
  expect(h.facade.pending()).toEqual(frozen);
  expect(h.facade.canSubmit()).toBe(false);
});
