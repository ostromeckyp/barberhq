import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { AppUpdate, RELOAD_PAGE } from './app-update';

function setup(isEnabled = true) {
  const versionUpdates = new Subject<VersionEvent>();
  const onAction = new Subject<void>();
  const open = vi.fn(() => ({ onAction: () => onAction }));
  const reload = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SwUpdate, useValue: { isEnabled, versionUpdates } },
      { provide: MatSnackBar, useValue: { open } },
      { provide: RELOAD_PAGE, useValue: reload },
    ],
  });
  TestBed.inject(AppUpdate).start();
  return { versionUpdates, onAction, open, reload };
}

it('prompts with translated text and reloads on action when a version is ready', () => {
  const { versionUpdates, onAction, open, reload } = setup();
  versionUpdates.next({
    type: 'VERSION_READY',
    currentVersion: { hash: 'a' },
    latestVersion: { hash: 'b' },
  });
  expect(open).toHaveBeenCalledWith('New version available', 'Reload', expect.any(Object));
  expect(reload).not.toHaveBeenCalled();
  onAction.next();
  expect(reload).toHaveBeenCalledTimes(1);
});

it('shows nothing for other events', () => {
  const { versionUpdates, open } = setup();
  versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
  versionUpdates.next({
    type: 'VERSION_INSTALLATION_FAILED',
    version: { hash: 'b' },
    error: 'x',
  });
  expect(open).not.toHaveBeenCalled();
});

it('subscribes to nothing when the service worker is disabled', () => {
  const { versionUpdates, open } = setup(false);
  expect(versionUpdates.observed).toBe(false);
  versionUpdates.next({
    type: 'VERSION_READY',
    currentVersion: { hash: 'a' },
    latestVersion: { hash: 'b' },
  });
  expect(open).not.toHaveBeenCalled();
});
