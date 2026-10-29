import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { expect, it, vi } from 'vitest';
import { SessionFacade } from '../../auth/feature/session.facade';
import { DeliveryApi } from '../data-access/delivery-api';
import { DELIVERY_JOURNAL, DeliveryJournal } from '../feature/delivery-journal';
import { DeliveryProcedureSettings } from './delivery-procedure-settings';
import type {
  DeliveryProcedureDto,
  SetDeliveryProcedureInput,
} from '../../../../../../shared/contracts/delivery/index';
const member = { userId: 'one', businessId: 'business', role: 'HQ' as const, salonIds: ['salon'] };
const scope = { userId: 'one', businessId: 'business', salonId: '', targetId: 'DAMAGED' };
async function settle() {
  TestBed.flushEffects();
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.flushEffects();
}
function storage() {
  const rows = new Map<string, string>();
  return new DeliveryJournal({
    getItem: (key) => rows.get(key) ?? null,
    setItem: (key, value) => {
      rows.set(key, value);
    },
    removeItem: (key) => {
      rows.delete(key);
    },
    keys: () => [...rows.keys()],
  });
}
async function open(
  journal: DeliveryJournal,
  setProcedure: (input: SetDeliveryProcedureInput) => Promise<unknown>,
) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SessionFacade,
        useValue: { state: signal({ status: 'READY', membership: member }) },
      },
      { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
      { provide: DELIVERY_JOURNAL, useValue: journal },
      {
        provide: DeliveryApi,
        useValue: {
          getProcedureBindings: async (): Promise<DeliveryProcedureDto[]> => [],
          listProcedureDocuments: async () => ({ items: [], nextOffset: null }),
          setProcedure,
        },
      },
    ],
  });
  const component = TestBed.runInInjectionContext(() => new DeliveryProcedureSettings());
  await settle();
  return component;
}
it('restores the original procedure command after a lost response and dialog recreation', async () => {
  const journal = storage(),
    inputs: SetDeliveryProcedureInput[] = [];
  const run = async (input: SetDeliveryProcedureInput) => {
    inputs.push(input);
    if (inputs.length === 1) throw { code: 'UNKNOWN' };
    return { commandId: 'original', replayed: true };
  };
  const first = await open(journal, run);
  first.choose('DAMAGED', 'document');
  await first.save('DAMAGED');
  expect(journal.load(scope)).toEqual({ type: 'SET_PROCEDURE', input: inputs[0] });
  TestBed.resetTestingModule();
  const reopened = await open(journal, run);
  expect(reopened.pending()).toEqual(inputs[0]);
  reopened.choose('DAMAGED', 'other');
  await reopened.save('DAMAGED');
  expect(inputs[1]).toEqual(inputs[0]);
  expect(journal.load(scope)).toBeNull();
});
it('retains a saved procedure key when replay loses authorization', async () => {
  const journal = storage();
  const input = {
    kind: 'DAMAGED' as const,
    documentId: 'document',
    expectedRevision: 0,
    idempotencyKey: 'original-key',
  };
  journal.save(scope, { type: 'SET_PROCEDURE', input });
  const run = vi.fn(async () => {
    throw { code: 'FORBIDDEN' };
  });
  const component = await open(journal, run);
  await component.save('DAMAGED');
  expect(journal.load(scope)).toEqual({ type: 'SET_PROCEDURE', input });
  expect(component.pending()).toEqual(input);
  await component.save('DAMAGED');
  expect(run).toHaveBeenCalledTimes(1);
});
