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
