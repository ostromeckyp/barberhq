import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublicConfig } from '../../../scripts/config/public-config';
import { App } from './app';
import { FIREBASE } from './core/firebase.providers';
import { runtimeConfig } from './core/public-config';

it('keeps an unconfigured development build out of the authenticated app', async () => {
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  expect(page.textContent).toContain('Workspace setup required');
  expect(page.querySelector('router-outlet')).toBeNull();
});

@Component({ template: '<p>Home page</p>' })
class HomePage {}

describe('boot splash', () => {
  afterEach(() => {
    runtimeConfig.publicConfig = null;
  });

  it('shows the splash until the first navigation ends', async () => {
    runtimeConfig.publicConfig = {} as PublicConfig;
    let allow: (value: boolean) => void = () => undefined;
    const session = new Promise<boolean>((resolve) => (allow = resolve));
    const guard = () => session;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: HomePage, canActivate: [guard] }]),
        { provide: FIREBASE, useValue: { appCheck: () => Promise.resolve(null) } },
      ],
    });
    const fixture = TestBed.createComponent(App);
    const page = fixture.nativeElement as HTMLElement;
    TestBed.inject(Router).initialNavigation();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(page.querySelector('app-boot-splash')?.textContent).toContain('BarberHQ');
    expect(page.textContent).not.toContain('Home page');

    allow(true);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page.querySelector('app-boot-splash')).toBeNull();
    expect(page.textContent).toContain('Home page');
  });

  it('hides the splash when the first navigation is cancelled', async () => {
    runtimeConfig.publicConfig = {} as PublicConfig;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: HomePage, canActivate: [() => false] }]),
        { provide: FIREBASE, useValue: { appCheck: () => Promise.resolve(null) } },
      ],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-boot-splash')).not.toBeNull();

    TestBed.inject(Router).initialNavigation();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-boot-splash')).toBeNull();
  });

  it('starts App Check at idle after the first navigation, not before', async () => {
    runtimeConfig.publicConfig = {} as PublicConfig;
    const appCheck = vi.fn(() => Promise.resolve(null));
    let idle: (() => void) | undefined;
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      idle = callback;
      return 1;
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: HomePage }]),
        { provide: FIREBASE, useValue: { appCheck } },
      ],
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(idle).toBeUndefined();
    expect(appCheck).not.toHaveBeenCalled();

    TestBed.inject(Router).initialNavigation();
    await fixture.whenStable();
    expect(idle).toBeDefined();
    expect(appCheck).not.toHaveBeenCalled();

    idle?.();
    expect(appCheck).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
