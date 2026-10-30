import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { SubmissionOutcome } from '../../../../../../shared/contracts/draft/index';
import { OrderOutcome } from './order-outcome';

function render(outcome: SubmissionOutcome) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(OrderOutcome);
  fixture.componentRef.setInput('outcome', outcome);
  fixture.componentRef.setInput('salonId', 'salon-1');
  fixture.componentRef.setInput('products', [{ productId: 'p1', productName: 'Matowa' }]);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { text: el.textContent ?? '', links: Array.from(el.querySelectorAll('a')) };
}

describe('OrderOutcome', () => {
  it('shows a readable success message and the request link', () => {
    const { text, links } = render({ status: 'CREATED', requestId: 'r1' } as SubmissionOutcome);
    expect(text).toContain('Request submitted.');
    expect(text).not.toContain('CREATED');
    expect(links[0].getAttribute('href')).toBe('/salons/salon-1/requests/r1');
  });

  it('shows the failure message without the status word and names conflicting products', () => {
    const { text, links } = render({
      status: 'FAILED',
      code: 'E1',
      conflicts: [
        { productId: 'p1', requestId: 'r2' },
        { productId: 'p9', requestId: 'r3' },
      ],
    } as SubmissionOutcome);
    expect(text).toContain('Request was not submitted (E1)');
    expect(text).not.toContain('FAILED');
    expect(links[0].textContent).toContain('Matowa');
    expect(links[1].textContent).toContain('p9');
  });

  it('explains an unconfirmed submission and links to the request list', () => {
    const { text, links } = render({ status: 'UNKNOWN' } as SubmissionOutcome);
    expect(text).toContain('We could not confirm the request. Check your request list.');
    expect(text).not.toContain('UNKNOWN');
    expect(links[0].getAttribute('href')).toBe('/salons/salon-1/requests');
  });
});
