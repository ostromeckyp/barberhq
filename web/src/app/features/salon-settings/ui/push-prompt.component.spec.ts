import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { PushFacade } from '../feature/push.facade';
import { PushPromptComponent } from './push-prompt.component';

const dismissedKey = 'barberhq.push.promptDismissed';

function setup(status: string, available = true) {
  const facade = {
    status: signal(status),
    busy: signal(false),
    available: signal(available),
    enable: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [PushPromptComponent],
    providers: [{ provide: PushFacade, useValue: facade }],
  });
  const fixture = TestBed.createComponent(PushPromptComponent);
  fixture.detectChanges();
  return { facade, el: fixture.nativeElement as HTMLElement, fixture };
}

afterEach(() => localStorage.removeItem(dismissedKey));

it('offers notifications to a salon member who has not enabled them', () => {
  const h = setup('default');
  expect(h.el.textContent).toContain('Get a notification when HQ updates your requests');
  const enable = [...h.el.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Enable notifications'),
  )!;
  enable.click();
  expect(h.facade.enable).toHaveBeenCalled();
});

it('hides once notifications are on, blocked, unsupported or for HQ', () => {
  for (const [status, available] of [
    ['granted', true],
    ['denied', true],
    ['unsupported', true],
    ['default', false],
  ] as const) {
    TestBed.resetTestingModule();
    const h = setup(status, available);
    expect(h.el.querySelector('aside')).toBeNull();
  }
});

it('shows the Home Screen hint on an iPhone browser tab', () => {
  const h = setup('install-required');
  expect(h.el.textContent).toContain('Add BarberHQ to the Home Screen');
  expect(h.el.textContent).not.toContain('Enable notifications');
});

it('stays dismissed on this device after Not now', () => {
  const h = setup('default');
  const later = [...h.el.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Not now'),
  )!;
  later.click();
  h.fixture.detectChanges();
  expect(h.el.querySelector('aside')).toBeNull();
  TestBed.resetTestingModule();
  expect(setup('default').el.querySelector('aside')).toBeNull();
});

it('keeps working when storage is blocked', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  const h = setup('default');
  expect(h.el.querySelector('aside')).not.toBeNull();
  [...h.el.querySelectorAll('button')].find((b) => b.textContent?.includes('Not now'))!.click();
  h.fixture.detectChanges();
  expect(h.el.querySelector('aside')).toBeNull();
  get.mockRestore();
  set.mockRestore();
});
