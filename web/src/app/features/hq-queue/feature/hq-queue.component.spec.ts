import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { DeliveryIssuesFacade } from '../../delivery/feature/delivery-issues.facade';
import { HqQueueComponent } from './hq-queue.component';
import { HqQueueFacade } from './hq-queue.facade';

function render(state: { loading: boolean; loaded: boolean; offset: number; hasNext: boolean }) {
  const facade = {
    loading: signal(state.loading),
    loaded: signal(state.loaded),
    offset: signal(state.offset),
    hasNext: signal(state.hasNext),
    error: signal(false),
    pending: signal([]),
    reserved: signal([]),
    other: signal([]),
  };
  TestBed.configureTestingModule({
    imports: [HqQueueComponent],
    providers: [provideRouter([])],
  });
  TestBed.overrideComponent(HqQueueComponent, {
    set: {
      providers: [
        { provide: HqQueueFacade, useValue: facade },
        {
          provide: DeliveryIssuesFacade,
          useValue: { selected: signal(false), openCount: signal(0) },
        },
      ],
    },
  });
  const fixture = TestBed.createComponent(HqQueueComponent);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, fixture };
}
it('shows no counts or empty text while the first load is pending', async () => {
  const { el, fixture } = render({ loading: true, loaded: false, offset: 0, hasNext: false });
  await new Promise((r) => setTimeout(r, 250));
  fixture.detectChanges();
  expect(el.querySelector('[role="progressbar"]')).not.toBeNull();
  expect(el.querySelector('h2')).toBeNull();
  expect(el.textContent).not.toContain('No requests in this section');
});
it('hides the pager on a single page and shows Next when another page exists', () => {
  expect(
    render({ loading: false, loaded: true, offset: 0, hasNext: false }).el.querySelector('nav'),
  ).toBeNull();
  TestBed.resetTestingModule();
  const { el } = render({ loading: false, loaded: true, offset: 0, hasNext: true });
  const next = [...el.querySelectorAll('nav button')].find((b) => b.textContent?.includes('Next'));
  expect(next).toBeTruthy();
  expect((next as HTMLButtonElement).disabled).toBe(false);
});
it('switches between requests and delivery issues with one toggle group', () => {
  const { el } = render({ loading: false, loaded: true, offset: 0, hasNext: false });
  const group = el.querySelector('mat-button-toggle-group') as HTMLElement;
  expect(group.getAttribute('aria-label')).toBe('Queue view');
  const toggles = [...group.querySelectorAll('mat-button-toggle')].map((t) =>
    t.textContent?.replace(/\s+/g, ' ').trim(),
  );
  expect(toggles).toEqual(['receipt_longRequests', 'report_problemDelivery issues (0)']);
});
