import { Service } from '@angular/core';
import { getApp } from 'firebase/app';
import { runtimeConfig } from './public-config';
import type { PushStatus } from './models/push-status';

/** Thrown by `enable()` when the user did not grant notification permission. */
export class PushDeniedError extends Error {
  constructor() {
    super('Notification permission was not granted.');
  }
}

const registrationWaitMs = 10_000;

const isIos = () =>
  /iPhone|iPad/.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** The only place that touches `firebase/messaging`; loaded lazily to stay out of the initial bundle. */
@Service()
export class PushMessaging {
  async status(): Promise<Exclude<PushStatus, 'error'>> {
    if (runtimeConfig.useEmulators || !runtimeConfig.publicConfig?.messaging?.vapidKey)
      return 'unsupported';
    const { isSupported } = await import('firebase/messaging');
    if (!(await isSupported()) || !(await this.registration())) return 'unsupported';
    if (isIos() && !isStandalone()) return 'install-required';
    return Notification.permission;
  }

  /** Must be called from a user click: it may show the permission prompt. */
  async enable(): Promise<string> {
    if ((await Notification.requestPermission()) !== 'granted') throw new PushDeniedError();
    return this.token();
  }

  /** The current token without prompting; null unless permission is already granted. */
  async currentToken(): Promise<string | null> {
    if ((await this.status()) !== 'granted') return null;
    return this.token();
  }

  async disable(): Promise<void> {
    const { deleteToken, getMessaging } = await import('firebase/messaging');
    await deleteToken(getMessaging(getApp()));
  }

  private async registration(): Promise<ServiceWorkerRegistration | undefined> {
    const sw = navigator.serviceWorker;
    if (!sw) return undefined;
    const existing = await sw.getRegistration();
    if (existing) return existing;
    // ngsw registers late (registerWhenStable); give a fresh install a bounded wait.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<undefined>((done) => {
      timer = setTimeout(() => done(undefined), registrationWaitMs);
    });
    try {
      return await Promise.race([sw.ready, timeout]);
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private async token(): Promise<string> {
    const { getMessaging, getToken } = await import('firebase/messaging');
    return getToken(getMessaging(getApp()), {
      vapidKey: runtimeConfig.publicConfig?.messaging?.vapidKey,
      serviceWorkerRegistration: await this.registration(),
    });
  }
}
