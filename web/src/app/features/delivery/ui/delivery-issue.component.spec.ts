import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { DeliveryIssueFacade } from '../feature/delivery-issue.facade';
import { DeliveryIssueComponent } from './delivery-issue.component';

const at = '2026-10-01T10:00:00Z';
const quantities = (productId: string, good: number, damaged: number, missing: number) => ({
  productId,
  goodQuantity: good,
  damagedQuantity: damaged,
  missingQuantity: missing,
});
const event = (id: string, type: string, extra: Record<string, unknown> = {}) => ({
  id,
  type,
  recordedAt: at,
  actorLabel: 'delivery.actor.HQ',
  note: null,
  quantities: [],
  ...extra,
});

function render(opts: { offset: number; more: boolean }, overrides: Record<string, unknown> = {}) {
  const issue = {
    id: 'i',
    salonName: 'Salon',
    createdAt: at,
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
      recordedAt: at,
      procedureReferences: [],
    },
    ...overrides,
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
it('shows the issue history as a timeline with one marker per event', () => {
  const el = render(
    { offset: 0, more: false },
    {
      events: [
        event('e3', 'REPLACEMENT_REJECTED'),
        event('e2', 'NOTE_ADDED', { note: 'Arranged with warehouse' }),
        event('e1', 'OPENED', { quantities: [quantities('p1', 8, 2, 0)] }),
      ],
    },
  );
  const steps = [...el.querySelectorAll('ol.app-timeline > li')];
  expect(steps).toHaveLength(3);
  expect(steps.every((s) => s.querySelector('.app-timeline-marker mat-icon'))).toBe(true);
  expect(el.querySelectorAll('.app-timeline-line')).toHaveLength(2);
  expect(steps[0].classList).toContain('rejected');
  expect(steps[1].querySelector('.app-timeline-note')?.textContent).toContain(
    'Arranged with warehouse',
  );
  expect(steps[2].textContent).toContain('8 good · 2 damaged · 0 missing');
});

it('names the product on history quantities when the delivery had several products', () => {
  const el = render(
    { offset: 0, more: false },
    {
      items: [
        { productId: 'p1', productName: 'Pomada' },
        { productId: 'p2', productName: 'Szampon' },
      ],
      events: [
        event('e1', 'OPENED', {
          quantities: [quantities('p1', 8, 2, 0), quantities('p2', 3, 0, 1)],
        }),
      ],
    },
  );
  const text = el.querySelector('ol.app-timeline')?.textContent ?? '';
  expect(text).toContain('Pomada: 8 good · 2 damaged · 0 missing');
  expect(text).toContain('Szampon: 3 good · 0 damaged · 1 missing');
});

it('shows the original inspection as labelled figures with the report and who inspected it', () => {
  const el = render(
    { offset: 0, more: false },
    {
      rootReceipt: {
        items: [{ productName: 'Pomada', ...quantities('p1', 8, 2, 0) }],
        report: { description: 'Two cracked jars', batchIdentifier: 'B-17' },
        actorLabel: 'delivery.actor.RECIPIENT',
        recordedAt: at,
        procedureReferences: [],
      },
    },
  );
  const card = el.querySelector('section[aria-label="Original inspection"]')!;
  expect(card.querySelector('.card-header a')?.textContent).toContain('Open original request');
  const figures = [...card.querySelectorAll('.app-figures > div')].map(
    (f) =>
      `${f.querySelector('span')?.textContent?.trim()} ${f.querySelector('strong')?.textContent}`,
  );
  expect(figures).toEqual(['Good units 8', 'Damaged units 2', 'Missing units 0']);
  expect(card.querySelector('blockquote')?.textContent).toContain('Two cracked jars');
  expect(card.querySelector('blockquote')?.textContent).toContain('Batch: B-17');
  expect(card.querySelector('.inspected-by')?.textContent).toContain('Inspected by');
});

it('keeps Previous on later pages', () => {
  const el = render({ offset: 20, more: false });
  const prev = [...el.querySelectorAll('nav button')].filter((b) =>
    b.textContent?.includes('Previous'),
  );
  expect(prev).toHaveLength(2);
});
