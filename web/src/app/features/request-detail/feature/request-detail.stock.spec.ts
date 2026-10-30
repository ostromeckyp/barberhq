import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { RequestDetailComponent } from './request-detail.component';
import { RequestDetailFacade } from './request-detail.facade';

const item = (id: string, name: string, n: number) => ({
  productId: id,
  productName: name,
  quantity: n,
  dispatchedQuantity: 0,
  receivedQuantity: 0,
  stock: { hqOnHand: 10 + n, hqReserved: 2, hqAvailable: 8 + n, salonOnHand: n },
});

function render() {
  TestBed.configureTestingModule({
    imports: [RequestDetailComponent],
    providers: [provideRouter([])],
  });
  TestBed.overrideComponent(RequestDetailComponent, {
    set: {
      providers: [
        {
          provide: RequestDetailFacade,
          useValue: {
            workspace: 'HQ',
            back: signal(undefined),
            loading: signal(false),
            error: signal(false),
            message: signal(null),
            availableActions: signal([]),
            request: signal({
              id: 'abcdefgh-1',
              salonId: 's',
              salonName: 'Mokotów',
              state: 'RESERVED',
              itemCount: 2,
              totalUnits: 5,
              items: [item('a', 'Pomade', 2), item('b', 'Beard oil', 3)],
              timeline: [],
              delivery: null,
            }),
          },
        },
      ],
    },
  });
  const fixture = TestBed.createComponent(RequestDetailComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

it('shows stock now as one table with a row per product', () => {
  const el = render();
  const table = el.querySelector('aside table');
  expect(table).toBeTruthy();
  const headers = [...table!.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
  expect(headers).toEqual([
    'Product',
    'HQ stock',
    'Reserved',
    'Available',
    'In transit',
    'Mokotów stock',
  ]);
  expect(table!.querySelectorAll('tbody tr')).toHaveLength(2);
  expect(el.querySelectorAll('[data-testid="hq-on-hand"]')).toHaveLength(2);
  expect(el.querySelectorAll('[data-testid="salon-on-hand"]')).toHaveLength(2);
});

it('explains the columns once in a legend, not per row', () => {
  const el = render();
  expect(el.querySelectorAll('aside .stock-legend')).toHaveLength(1);
  expect(el.textContent?.match(/On the shelf/g)).toHaveLength(1);
});
