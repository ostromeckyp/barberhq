import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { SessionFacade } from '../auth/feature/session.facade';
import { SalonShorthandApi } from '../salon-settings/data-access/salon-shorthand-api';
import { HqShorthandComponent } from './hq-shorthand.component';

const row = (id: string, salonName: string) => ({
  id,
  salonId: `s-${salonName}`,
  salonName,
  productId: `p${id}`,
  productName: `Product ${id}`,
  phrase: `phrase ${id}`,
  revision: 1,
  status: 'active' as const,
  updatedAt: '2026-10-28T10:00:00Z',
});
it('shows every salon phrase read-only with paging', async () => {
  const listHq = vi
    .fn()
    .mockResolvedValueOnce({ rows: [row('1', 'Legnicka')], nextCursor: '1' })
    .mockResolvedValueOnce({ rows: [row('2', 'Łódzka')], nextCursor: null });
  TestBed.configureTestingModule({
    imports: [HqShorthandComponent],
    providers: [
      { provide: SalonShorthandApi, useValue: { listHq, remove: vi.fn() } },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'u', businessId: 'b', role: 'HQ', salonIds: [] },
          }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(HqShorthandComponent);
  fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  expect(listHq).toHaveBeenCalledWith('b', '');
  expect(el.textContent).toContain('Legnicka');
  expect(el.textContent).toContain('phrase 1');
  expect(el.querySelector('button[aria-label^="Remove"]')).toBeNull();
  (el.querySelector('button.load-more') as HTMLButtonElement).click();
  await TestBed.inject(ApplicationRef).whenStable();
  fixture.detectChanges();
  expect(listHq).toHaveBeenLastCalledWith('b', '1');
  expect(el.textContent).toContain('Łódzka');
  expect(el.querySelector('button.load-more')).toBeNull();
});
it('shows an empty state when no salon has learned shorthand', async () => {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HqShorthandComponent],
    providers: [
      {
        provide: SalonShorthandApi,
        useValue: { listHq: vi.fn().mockResolvedValue({ rows: [], nextCursor: null }) },
      },
      {
        provide: SessionFacade,
        useValue: {
          state: signal({
            status: 'READY',
            membership: { userId: 'u', businessId: 'b', role: 'HQ', salonIds: [] },
          }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(HqShorthandComponent);
  fixture.detectChanges();
  await TestBed.inject(ApplicationRef).whenStable();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('app-empty-state')).not.toBeNull();
});
