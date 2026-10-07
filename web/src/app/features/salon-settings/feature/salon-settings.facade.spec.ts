import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { SalonSettingsFacade } from './salon-settings.facade';
import { SalonSettingsApi, SettingsSaveError } from '../data-access/salon-settings-api';
import { SessionFacade } from '../../auth/feature/session.facade';
import { BrowserActivity } from '../../../core/browser-activity';
import type { SalonSettings } from '../../../../../../shared/contracts/settings';
const setting = (salonId = 'a', lowStockThreshold = 2, version = 1): SalonSettings => ({
  salonId,
  lowStockThreshold,
  version,
  updatedAt: '2026-10-07T10:00:00Z',
});
function setup() {
  const params = new BehaviorSubject(convertToParamMap({ salonId: 'a' }));
  const get = vi.fn().mockResolvedValue(setting()),
    save = vi.fn();
  const state = signal({
    status: 'READY',
    membership: { userId: 'u', businessId: 'b', role: 'SALON', salonIds: ['a', 'b'] },
  });
  TestBed.configureTestingModule({
    providers: [
      SalonSettingsFacade,
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: SessionFacade, useValue: { state } },
      { provide: BrowserActivity, useValue: { refreshTick: signal(0) } },
      { provide: SalonSettingsApi, useValue: { get, save, revision: signal(0) } },
    ],
  });
  const facade = TestBed.inject(SalonSettingsFacade);
  TestBed.tick();
  const settle = async () => {
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
  };
  return { params, get, save, state, facade, settle };
}
it('loads_authoritative_value_and_preserves_edits_after_stale_save', async () => {
  const h = setup();
  await h.settle();
  expect(h.facade.model().lowStockThreshold).toBe(2);
  h.facade.model.set({ lowStockThreshold: 4 });
  h.save.mockRejectedValue(new SettingsSaveError('STALE_STATE'));
  await h.facade.save();
  expect(h.facade.stale()).toBe(true);
  expect(h.facade.model().lowStockThreshold).toBe(4);
  expect(h.facade.canSave()).toBe(false);
  h.get.mockResolvedValue(setting('a', 8, 2));
  h.facade.reload();
  TestBed.tick();
  await h.settle();
  expect(h.facade.model().lowStockThreshold).toBe(8);
  expect(h.facade.version()).toBe(2);
});
it('reconciles_unknown_save_without_claiming_confirmation_from_matching_values', async () => {
  const h = setup();
  await h.settle();
  h.facade.model.set({ lowStockThreshold: 4 });
  h.save.mockRejectedValue(new SettingsSaveError('UNKNOWN'));
  h.get.mockResolvedValue(setting('a', 4, 2));
  await h.facade.save();
  TestBed.tick();
  await h.settle();
  expect(h.get).toHaveBeenCalledTimes(2);
  expect(h.save).toHaveBeenCalledTimes(1);
  expect(h.facade.saved()).toBe(false);
  expect(h.facade.version()).toBe(2);
  expect(h.facade.error()).toContain('not confirmed');
  expect(h.facade.canSave()).toBe(true);
});
it('discards_previous_salon_save_and_load_completion', async () => {
  const h = setup();
  await h.settle();
  let finish!: (v: SalonSettings) => void;
  h.facade.model.set({ lowStockThreshold: 4 });
  h.save.mockImplementation(() => new Promise((r) => (finish = r)));
  const work = h.facade.save();
  h.get.mockResolvedValue(setting('b', 1));
  h.params.next(convertToParamMap({ salonId: 'b' }));
  TestBed.tick();
  await h.settle();
  finish(setting('a', 4, 2));
  await work;
  expect(h.facade.model().lowStockThreshold).toBe(1);
  expect(h.facade.saved()).toBe(false);
  let load!: (v: SalonSettings) => void;
  h.get.mockImplementationOnce(() => new Promise((r) => (load = r)));
  h.params.next(convertToParamMap({ salonId: 'a' }));
  TestBed.tick();
  h.params.next(convertToParamMap({ salonId: 'b' }));
  TestBed.tick();
  load(setting('a', 99));
  await h.settle();
  expect(h.facade.model().lowStockThreshold).toBe(1);
});
it('rejects_invalid_values_and_does_not_invent_defaults_on_read_error', async () => {
  const h = setup();
  await h.settle();
  for (const value of [-1, 1.5, 2147483648, NaN]) {
    h.facade.model.set({ lowStockThreshold: value });
    await h.facade.save();
  }
  expect(h.save).not.toHaveBeenCalled();
  h.get.mockRejectedValue(Error('No settings'));
  h.params.next(convertToParamMap({ salonId: 'b' }));
  TestBed.tick();
  await h.settle();
  expect(h.facade.version()).toBeUndefined();
  expect(h.facade.canSave()).toBe(false);
});
