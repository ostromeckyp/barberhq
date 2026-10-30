import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it, vi } from 'vitest';
import { Language } from '../core/language';
import { ShellComponent } from './shell.component';
import { ShellFacade } from './shell.facade';

function setup() {
  const current = signal<'en' | 'pl'>('en');
  const set = vi.fn((lang: 'en' | 'pl') => current.set(lang));
  const facade = {
    home: () => '/hq',
    ready: () => false,
    isHqUser: () => false,
    isHqWorkspace: () => false,
    isActingForSalon: () => false,
    actingSalonName: () => '',
    selectedWorkspace: () => null,
    salons: () => [],
    signOutError: () => '',
    salonContext: { salonId: () => null },
  };
  TestBed.configureTestingModule({
    imports: [ShellComponent],
    providers: [provideRouter([]), { provide: Language, useValue: { current, set } }],
  });
  TestBed.overrideComponent(ShellComponent, {
    set: { providers: [{ provide: ShellFacade, useValue: facade }] },
  });
  const fixture = TestBed.createComponent(ShellComponent);
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement, set };
}

const menuItems = () => [...document.querySelectorAll<HTMLElement>('[mat-menu-item]')];
const item = (text: string) => menuItems().find((el) => el.textContent?.includes(text));

it('switches language from the account menu items and marks the current one', async () => {
  const h = setup();
  h.root.querySelector<HTMLElement>('button[aria-label="Account menu"]')?.click();
  await h.fixture.whenStable();
  const labels = menuItems().map((el) => el.textContent ?? '');
  expect(labels.findIndex((t) => t.includes('Language'))).toBe(0);
  expect(labels.findIndex((t) => t.includes('Sign out'))).toBe(1);
  item('Language')?.click();
  await h.fixture.whenStable();
  const english = item('English');
  expect(english?.getAttribute('role')).toBe('menuitemradio');
  expect(english?.getAttribute('aria-checked')).toBe('true');
  expect(item('Polski')?.getAttribute('aria-checked')).toBe('false');
  item('Polski')?.click();
  expect(h.set).toHaveBeenCalledWith('pl');
});
