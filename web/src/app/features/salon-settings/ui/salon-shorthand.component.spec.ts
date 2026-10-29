import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { SalonShorthandFacade } from '../feature/salon-shorthand.facade';
import { SalonShorthandComponent } from './salon-shorthand.component';

const row = (id: string) => ({
  id,
  salonId: 'a',
  salonName: 'Salon A',
  productId: `p${id}`,
  productName: `Product ${id}`,
  phrase: `phrase ${id}`,
  revision: 1,
  status: 'active' as const,
  updatedAt: '2026-10-28T10:00:00Z',
});
function render(canRemove: boolean, rows = [row('1')]) {
  const facade = {
    rows: signal(rows),
    loading: signal(false),
    error: signal(''),
    removing: signal<string | null>(null),
    canRemove: signal(canRemove),
    hasMore: signal(false),
    empty: signal(rows.length === 0),
    remove: vi.fn(),
    reload: vi.fn(),
    loadMore: vi.fn(),
  };
  TestBed.configureTestingModule({ imports: [SalonShorthandComponent] });
  TestBed.overrideComponent(SalonShorthandComponent, {
    set: { providers: [{ provide: SalonShorthandFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(SalonShorthandComponent);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, facade };
}
it('lists phrase to product with remove only for the salon staff', () => {
  const staff = render(true);
  expect(staff.el.textContent).toContain('phrase 1');
  expect(staff.el.textContent).toContain('Product 1');
  const button = staff.el.querySelector(
    'button[aria-label="Remove shorthand phrase 1"]',
  ) as HTMLButtonElement;
  button.click();
  expect(staff.facade.remove).toHaveBeenCalledWith(row('1'));
  TestBed.resetTestingModule();
  const hq = render(false);
  expect(hq.el.querySelector('button[aria-label^="Remove shorthand"]')).toBeNull();
});
it('explains the empty state', () => {
  const { el } = render(true, []);
  expect(el.textContent).toContain('No salon shorthand yet.');
});
