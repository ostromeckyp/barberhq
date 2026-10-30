import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { BackLink } from './back-link';

it('renders a router link with the label and a decorative icon', () => {
  TestBed.configureTestingModule({ imports: [BackLink], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(BackLink);
  fixture.componentRef.setInput('link', '/hq/stock');
  fixture.componentRef.setInput('label', 'Back to stock');
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const anchor = root.querySelector('a');
  expect(anchor?.getAttribute('href')).toMatch(/\/hq\/stock$/);
  expect(anchor?.textContent).toContain('Back to stock');
  expect(root.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
});

it('renders a button that emits back when no link is given', () => {
  TestBed.configureTestingModule({ imports: [BackLink], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(BackLink);
  fixture.componentRef.setInput('label', 'Back to list');
  let emitted = 0;
  fixture.componentInstance.back.subscribe(() => emitted++);
  fixture.detectChanges();
  const button = (fixture.nativeElement as HTMLElement).querySelector('button');
  expect(button?.textContent).toContain('Back to list');
  button?.click();
  expect(emitted).toBe(1);
});
