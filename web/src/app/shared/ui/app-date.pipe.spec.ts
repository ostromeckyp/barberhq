import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { Language } from '../../core/language';
import { AppDatePipe } from './app-date.pipe';

@Component({
  imports: [AppDatePipe],
  template: `{{ value | appDate: 'd MMM y' : 'UTC' }}`,
})
class DateHost {
  readonly value = '2026-10-07T10:00:00Z';
}

const current = signal<'en' | 'pl'>('en');
function setup() {
  current.set('en');
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Language,
        useValue: {
          current,
          locale: () => (current() === 'pl' ? 'pl' : 'en-GB'),
          set: (lang: 'en' | 'pl') => current.set(lang),
        },
      },
    ],
  });
  return TestBed.runInInjectionContext(() => new AppDatePipe());
}

it('formats in English and Polish', () => {
  const pipe = setup();
  expect(pipe.transform('2026-10-07T10:00:00Z', 'd MMM y', 'UTC')).toBe('7 Oct 2026');
  current.set('pl');
  expect(pipe.transform('2026-10-07T10:00:00Z', 'd MMM y', 'UTC')).toBe('7 paź 2026');
});

it('switching language changes the rendered output', async () => {
  setup();
  const fixture = TestBed.createComponent(DateHost);
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent.trim()).toBe('7 Oct 2026');
  current.set('pl');
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent.trim()).toBe('7 paź 2026');
});

it('returns an empty string for null and undefined', () => {
  const pipe = setup();
  expect(pipe.transform(null, 'd MMM y')).toBe('');
  expect(pipe.transform(undefined, 'd MMM y')).toBe('');
});
