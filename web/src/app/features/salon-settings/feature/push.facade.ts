import { Service, computed, effect, inject, signal, untracked } from '@angular/core';
import { Language } from '../../../core/language';
import type { PushStatus } from '../../../core/models/push-status';
import { PushDeniedError, PushMessaging } from '../../../core/push-messaging';
import { SessionFacade } from '../../auth/feature/session.facade';
import { PushApi } from '../data-access/push-api';

const signOutBudgetMs = 3000;
const optOutKey = 'barberhq.push.optOut';

/** Per-device "Turn off" choice; unreadable storage counts as not opted out. */
const optedOut = (): boolean => {
  try {
    return localStorage.getItem(optOutKey) === '1';
  } catch {
    return false;
  }
};
const setOptOut = (value: boolean): void => {
  try {
    if (value) localStorage.setItem(optOutKey, '1');
    else localStorage.removeItem(optOutKey);
  } catch {
    /* Storage may be blocked; the choice then lasts until the permission changes. */
  }
};

/** Push notifications for this device; salon staff only. */
@Service()
export class PushFacade {
  private readonly messaging = inject(PushMessaging);
  private readonly api = inject(PushApi);
  private readonly language = inject(Language);
  private readonly session = inject(SessionFacade);
  readonly status = signal<PushStatus>('unsupported');
  readonly busy = signal(false);
  /** HQ staff acting for a salon have no push registration. */
  readonly available = computed(() => {
    const s = this.session.state();
    return s.status === 'READY' && s.membership.role === 'SALON';
  });

  constructor() {
    // Silent re-register whenever a salon member signs in (token rotation, user switch).
    effect(() => {
      if (this.available()) untracked(() => void this.init());
    });
  }

  async init(): Promise<void> {
    if (!this.available()) return;
    try {
      const status = await this.messaging.status();
      if (status === 'granted' && optedOut()) {
        this.status.set('default');
        return;
      }
      this.status.set(status);
      if (status !== 'granted') return;
      const token = await this.messaging.currentToken();
      if (token) await this.api.register(token, this.language.current());
    } catch {
      this.status.set('error');
    }
  }

  async enable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const token = await this.messaging.enable();
      await this.api.register(token, this.language.current());
      setOptOut(false);
      this.status.set('granted');
    } catch (error) {
      this.status.set(error instanceof PushDeniedError ? 'denied' : 'error');
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const token = await this.messaging.currentToken();
      if (token) await this.api.unregister(token);
      await this.messaging.disable();
      setOptOut(true);
      this.status.set('default');
    } catch {
      this.status.set('error');
    } finally {
      this.busy.set(false);
    }
  }

  /** Best effort before sign-out: never throws and never waits longer than a few seconds. */
  async unregisterOnSignOut(): Promise<void> {
    if (!this.available()) return;
    const work = (async () => {
      const token = await this.messaging.currentToken();
      if (!token) return;
      await this.api.unregister(token);
      await this.messaging.disable();
    })().catch(() => undefined);
    await Promise.race([work, new Promise<void>((done) => setTimeout(done, signOutBudgetMs))]);
  }
}
