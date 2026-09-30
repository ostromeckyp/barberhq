import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { it, expect } from 'vitest';
it('keeps an unconfigured development build out of the authenticated app', async () => {
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  expect(page.textContent).toContain('Workspace setup required');
  expect(page.querySelector('router-outlet')).toBeNull();
});
