import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { SalonRequestsComponent } from './salon-requests.component';
import { SalonRequestsFacade } from './salon-requests.facade';

function render(offset: number, nextOffset: number | null) {
  TestBed.configureTestingModule({
    imports: [SalonRequestsComponent],
    providers: [provideRouter([])],
  });
  TestBed.overrideComponent(SalonRequestsComponent, {
    set: {
      providers: [
        {
          provide: SalonRequestsFacade,
          useValue: {
            loading: signal(false),
            error: signal(false),
            items: signal([]),
            nextOffset: signal(nextOffset),
            context: signal({ kind: 'SALON', salonId: 'a', filter: 'ALL', offset }),
          },
        },
      ],
    },
  });
  const fixture = TestBed.createComponent(SalonRequestsComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    [...el.querySelectorAll('nav button')].find((b) => b.textContent?.includes(name));
  return { el, button };
}
it('hides the pager with a single page', () => {
  expect(render(0, null).el.querySelector('nav')).toBeNull();
});
it('shows Next enabled when another page exists', () => {
  expect((render(0, 50).button('Next') as HTMLButtonElement).disabled).toBe(false);
});
it('keeps Previous on a later page', () => {
  expect(render(50, null).button('Previous')).toBeTruthy();
});
