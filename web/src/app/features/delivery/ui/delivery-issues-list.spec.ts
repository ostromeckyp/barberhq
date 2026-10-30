import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { DeliveryIssuesFacade } from '../feature/delivery-issues.facade';
import { DeliveryIssuesList } from './delivery-issues-list';

function render(offset: number, hasNext: boolean) {
  TestBed.configureTestingModule({
    imports: [DeliveryIssuesList],
    providers: [
      provideRouter([]),
      {
        provide: DeliveryIssuesFacade,
        useValue: {
          loading: signal(false),
          error: signal(false),
          rows: signal([]),
          status: signal('OPEN'),
          offset: signal(offset),
          hasNext: signal(hasNext),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(DeliveryIssuesList);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
it('hides the pager with a single page', () => {
  expect(render(0, false).querySelector('nav')).toBeNull();
});
it('shows an enabled Next with another page', () => {
  const next = [...render(0, true).querySelectorAll('nav button')].find((b) =>
    b.textContent?.includes('Next'),
  );
  expect((next as HTMLButtonElement).disabled).toBe(false);
});
