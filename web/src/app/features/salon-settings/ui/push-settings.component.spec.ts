import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { PushFacade } from '../feature/push.facade';
import { PushSettingsComponent } from './push-settings.component';

function setup(status: string, available = true) {
  const facade = {
    status: signal(status),
    busy: signal(false),
    available: signal(available),
    init: vi.fn(async () => undefined),
    enable: vi.fn(),
    disable: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [PushSettingsComponent],
    providers: [{ provide: PushFacade, useValue: facade }],
  });
  const fixture = TestBed.createComponent(PushSettingsComponent);
  fixture.detectChanges();
  return { facade, el: fixture.nativeElement as HTMLElement, fixture };
}

it('shows the enable button for default and calls enable on click', async () => {
  const h = setup('default');
  await h.fixture.whenStable();
  const button = h.el.querySelector('button')!;
  expect(button.textContent).toContain('Enable notifications');
  button.click();
  expect(h.facade.enable).toHaveBeenCalled();
});

it('renders granted, denied, install and error copy', async () => {
  for (const [status, text] of [
    ['granted', 'Notifications are on on this device'],
    ['denied', 'Notifications are blocked in browser settings'],
    ['install-required', 'Add BarberHQ to the Home Screen'],
  ]) {
    TestBed.resetTestingModule();
    const h = setup(status);
    await h.fixture.whenStable();
    h.fixture.detectChanges();
    expect(h.el.textContent).toContain(text);
  }
});

it('is hidden when unsupported or not available', async () => {
  const h = setup('unsupported');
  await h.fixture.whenStable();
  expect(h.el.querySelector('section')).toBeNull();
  TestBed.resetTestingModule();
  const g = setup('default', false);
  await g.fixture.whenStable();
  expect(g.el.querySelector('section')).toBeNull();
});

it('shows the error banner with a retry that calls enable', async () => {
  const h = setup('error');
  await h.fixture.whenStable();
  expect(h.el.querySelector('app-stale-banner')?.textContent).toContain(
    'Could not turn on notifications',
  );
  h.el.querySelector<HTMLButtonElement>('app-stale-banner button')!.click();
  expect(h.facade.enable).toHaveBeenCalled();
});

it('re-runs the silent init on mount when the status is unsupported', async () => {
  const h = setup('unsupported');
  await h.fixture.whenStable();
  expect(h.facade.init).toHaveBeenCalled();
});

it('does not re-init on mount when the status is already known', async () => {
  const h = setup('granted');
  await h.fixture.whenStable();
  expect(h.facade.init).not.toHaveBeenCalled();
});
