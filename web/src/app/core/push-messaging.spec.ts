import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, isSupported, deleteToken } from 'firebase/messaging';
import { PushDeniedError, PushMessaging } from './push-messaging';
import { runtimeConfig } from './public-config';

vi.mock('firebase/app', () => ({ getApp: () => ({ name: 'app' }) }));
vi.mock('firebase/messaging', () => ({
  isSupported: vi.fn(),
  getMessaging: vi.fn(() => ({ m: 1 })),
  getToken: vi.fn(),
  deleteToken: vi.fn(),
}));

const registration = { scope: '/' };
function env(o: { ua?: string; standalone?: boolean; permission?: string; sw?: boolean }) {
  vi.stubGlobal('navigator', {
    userAgent: o.ua ?? 'Chrome',
    maxTouchPoints: 0,
    serviceWorker: { getRegistration: async () => (o.sw === false ? undefined : registration) },
  });
  vi.stubGlobal('matchMedia', () => ({ matches: o.standalone ?? false }));
  vi.stubGlobal('Notification', {
    permission: o.permission ?? 'default',
    requestPermission: vi.fn(async () => o.permission ?? 'default'),
  });
}
const publicConfig = (vapid: boolean) => (vapid ? { messaging: { vapidKey: 'VK' } } : {}) as never;

describe('PushMessaging', () => {
  beforeEach(() => {
    runtimeConfig.useEmulators = false;
    runtimeConfig.publicConfig = publicConfig(true);
    vi.mocked(isSupported).mockResolvedValue(true);
    vi.mocked(getToken).mockReset().mockResolvedValue('tok');
    env({});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    runtimeConfig.publicConfig = null;
  });
  const svc = () => TestBed.inject(PushMessaging);

  it('is unsupported on emulator builds, without vapidKey, without support or worker', async () => {
    runtimeConfig.useEmulators = true;
    expect(await svc().status()).toBe('unsupported');
    runtimeConfig.useEmulators = false;
    runtimeConfig.publicConfig = publicConfig(false);
    expect(await svc().status()).toBe('unsupported');
    runtimeConfig.publicConfig = publicConfig(true);
    vi.mocked(isSupported).mockResolvedValue(false);
    expect(await svc().status()).toBe('unsupported');
    vi.mocked(isSupported).mockResolvedValue(true);
    env({ sw: false });
    expect(await svc().status()).toBe('unsupported');
  });

  it('waits for a late service worker registration before deciding', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('navigator', {
        userAgent: 'Chrome',
        maxTouchPoints: 0,
        serviceWorker: {
          getRegistration: async () => undefined,
          ready: new Promise((resolve) => setTimeout(() => resolve(registration), 5000)),
        },
      });
      const pending = svc().status();
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toBe('default');
    } finally {
      vi.useRealTimers();
    }
  });

  it('is unsupported when no registration appears within the bound', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('navigator', {
        userAgent: 'Chrome',
        maxTouchPoints: 0,
        serviceWorker: { getRegistration: async () => undefined, ready: new Promise(() => {}) },
      });
      const pending = svc().status();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toBe('unsupported');
    } finally {
      vi.useRealTimers();
    }
  });

  it('requires install on iOS outside standalone, otherwise reports permission', async () => {
    env({ ua: 'iPhone', permission: 'granted' });
    expect(await svc().status()).toBe('install-required');
    env({ ua: 'iPhone', permission: 'granted', standalone: true });
    expect(await svc().status()).toBe('granted');
    env({ permission: 'denied' });
    expect(await svc().status()).toBe('denied');
    env({});
    expect(await svc().status()).toBe('default');
  });

  it('enable passes the registration and vapidKey to getToken', async () => {
    env({ permission: 'granted' });
    expect(await svc().enable()).toBe('tok');
    expect(getToken).toHaveBeenCalledWith(
      { m: 1 },
      { vapidKey: 'VK', serviceWorkerRegistration: registration },
    );
  });

  it('enable throws PushDeniedError without calling getToken', async () => {
    env({ permission: 'denied' });
    await expect(svc().enable()).rejects.toBeInstanceOf(PushDeniedError);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('currentToken is null unless granted; disable deletes the token', async () => {
    expect(await svc().currentToken()).toBeNull();
    env({ permission: 'granted' });
    expect(await svc().currentToken()).toBe('tok');
    await svc().disable();
    expect(deleteToken).toHaveBeenCalled();
  });

  it('status and currentToken never request permission', async () => {
    env({ permission: 'default' });
    await svc().status();
    await svc().currentToken();
    env({ permission: 'granted' });
    await svc().status();
    await svc().currentToken();
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
});
