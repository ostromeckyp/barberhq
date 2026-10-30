import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { DeliveryIssueFacade } from '../feature/delivery-issue.facade';
import { DeliveryIssueComponent } from './delivery-issue.component';

function render(opts: { offset: number; more: boolean }) {
  const issue = {
    id: 'i',
    salonName: 'Salon',
    createdAt: '2026-10-01T10:00:00Z',
    status: 'OPEN',
    items: [],
    replacements: [],
    events: [],
    hasMoreReplacements: opts.more,
    hasMoreEvents: opts.more,
    rootRequestId: 'r',
    rootReceipt: {
      items: [],
      report: null,
      actorLabel: 'x',
      recordedAt: '2026-10-01T10:00:00Z',
      procedureReferences: [],
    },
  };
  TestBed.configureTestingModule({
    imports: [DeliveryIssueComponent],
    providers: [provideRouter([])],
  });
  TestBed.overrideComponent(DeliveryIssueComponent, {
    set: {
      providers: [
        {
          provide: DeliveryIssueFacade,
          useValue: {
            view: 'HQ',
            loading: signal(false),
            busy: signal(false),
            message: signal(null),
            recoveryError: signal(null),
            error: signal(false),
            issue: signal(issue),
            statusKey: signal('delivery.status.OPEN'),
            procedures: signal(null),
            isHq: signal(false),
            replacementOffset: signal(opts.offset),
            eventOffset: signal(opts.offset),
            draft: { note: signal('') },
            locked: signal(false),
            requestLink: () => ['/'],
          },
        },
      ],
    },
  });
  const fixture = TestBed.createComponent(DeliveryIssueComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
it('hides both pagers with one page of replacements and history', () => {
  expect(render({ offset: 0, more: false }).querySelectorAll('nav')).toHaveLength(0);
});
it('shows Next on both pagers when more pages exist', () => {
  const el = render({ offset: 0, more: true });
  expect(el.querySelectorAll('nav')).toHaveLength(2);
});
it('keeps Previous on later pages', () => {
  const el = render({ offset: 20, more: false });
  const prev = [...el.querySelectorAll('nav button')].filter((b) =>
    b.textContent?.includes('Previous'),
  );
  expect(prev).toHaveLength(2);
});
