import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { Language } from '../../../core/language';
import { LanguageSelect } from './language-select';

function setup(initial: 'en' | 'pl') {
  const current = signal(initial);
  const set = vi.fn();
  TestBed.configureTestingModule({
    imports: [LanguageSelect],
    providers: [{ provide: Language, useValue: { current, set } }],
  });
  const fixture = TestBed.createComponent(LanguageSelect);
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement, set, current };
}

it('selecting pl calls Language.set("pl")', async () => {
  const h = setup('en');
  h.root.querySelector<HTMLElement>('.mat-mdc-select-trigger')?.click();
  h.fixture.detectChanges();
  await h.fixture.whenStable();
  const options = [...document.querySelectorAll<HTMLElement>('mat-option')];
  expect(options.map((o) => o.textContent?.trim())).toEqual(['Polski', 'English']);
  options.find((o) => o.textContent?.trim() === 'Polski')?.click();
  expect(h.set).toHaveBeenCalledWith('pl');
});

it('shows the current language and an accessible name', async () => {
  const h = setup('pl');
  await h.fixture.whenStable();
  h.fixture.detectChanges();
  expect(h.root.querySelector('.mat-mdc-select-value')?.textContent?.trim()).toBe('Polski');
  expect(h.root.querySelector('mat-select')?.getAttribute('aria-label')).toBe('Language');
});
