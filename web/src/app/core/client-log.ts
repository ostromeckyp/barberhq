import { DestroyRef, InjectionToken, Injector, Service, inject } from '@angular/core';
import {
  maxLogBatch,
  sanitizeLogEvent,
  type ClientLogEvent,
} from '../../../../shared/contracts/logging/index';
import { setCallObserver } from './call-function';
import { createClientLogPort, type ClientLogPort } from './client-log-port';
import { FIREBASE } from './firebase.providers';
import { runtimeConfig } from './public-config';

export type { ClientLogPort } from './client-log-port';

type Details = Record<string, string | number | boolean>;
type Context = Pick<ClientLogEvent, 'role' | 'businessId' | 'salonId'>;
// `owner` is the uid signed in when the event was recorded (null before sign-in).
type Stored = { id: string; owner: string | null; event: ClientLogEvent };

export const CLIENT_LOG_STORAGE = new InjectionToken<Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
> | null>('Client log storage', {
  providedIn: 'root',
  factory: () => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  },
});
export const CLIENT_LOG_PORT = new InjectionToken<ClientLogPort>('Client log port', {
  providedIn: 'root',
  factory: () => {
    // Firebase is resolved on first send, so logging works (and tests run) without it.
    const injector = inject(Injector);
    return createClientLogPort(() => injector.get(FIREBASE).auth);
  },
});

const KEY = 'barberhq.clientLog.v1';
const MAX_STORED = 500;
const SEND_AT = 20;
const DELAY_MS = 5_000;
const RETRY_MS = [30_000, 60_000, 120_000, 300_000];

/**
 * The only place that records browser log events. Events are allow-listed (no user content),
 * kept in `localStorage` until `clientLog` accepts them, and sent in batches; logging never
 * throws into or waits on the caller.
 */
@Service()
export class ClientLog {
  private readonly storage = inject(CLIENT_LOG_STORAGE);
  private readonly port = inject(CLIENT_LOG_PORT);
  private readonly sessionId = crypto.randomUUID();
  private memory: Stored[] = [];
  private context: Context = {};
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flushing = false;
  private failures = 0;

  constructor() {
    const onOnline = () => void this.flush();
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void this.flush();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHidden);
    setCallObserver((op, outcome, durationMs, code, reason) =>
      this.record(`call.${op}`, outcome, {
        durationMs,
        ...(code ? { code } : {}),
        ...(reason ? { details: { reason } } : {}),
      }),
    );
    inject(DestroyRef).onDestroy(() => {
      setCallObserver(null);
      clearTimeout(this.timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHidden);
    });
    if (this.load().length) this.schedule(DELAY_MS);
  }

  record(
    event: string,
    outcome: 'ok' | 'error' = 'ok',
    extra: { code?: string; durationMs?: number; details?: Details } = {},
  ): void {
    try {
      const clean = sanitizeLogEvent({
        ...this.context,
        ...extra,
        event,
        outcome,
        sessionId: this.sessionId,
        build: runtimeConfig.build,
        channel: this.port.channel(),
        clientTime: new Date().toISOString(),
      });
      if (!clean) return;
      const owner = this.port.uid();
      const stored = [...this.load(), { id: crypto.randomUUID(), owner, event: clean }];
      this.save(stored.slice(-MAX_STORED));
      // While retrying after a failure, the backoff timer stays in charge.
      if (stored.length >= SEND_AT && this.failures === 0) this.schedule(0);
      else if (!this.timer) this.schedule(DELAY_MS);
    } catch {
      /* Logging never breaks the app. */
    }
  }

  async step<T>(event: string, run: () => Promise<T>, details?: Details): Promise<T> {
    const started = performance.now();
    try {
      const result = await run();
      this.record(event, 'ok', { durationMs: performance.now() - started, details });
      return result;
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      this.record(event, 'error', {
        durationMs: performance.now() - started,
        details,
        ...(typeof code === 'string' ? { code } : {}),
      });
      throw error;
    }
  }

  setContext(context: Context): void {
    this.context = { ...context };
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    try {
      if (!this.port.online()) return;
      const uid = this.port.uid();
      if (!uid) return;
      // Events of an earlier user on this device are never sent under this user's uid.
      const all = this.load();
      const mine = all.filter((s) => s.owner === null || s.owner === uid);
      if (mine.length !== all.length) this.save(mine);
      const batch = mine.slice(0, maxLogBatch);
      if (!batch.length) return;
      const token = await this.port.token().catch(() => null);
      if (!token) return;
      const status = await this.port
        .send(
          batch.map((s) => s.event),
          token,
        )
        .catch(() => 0);
      if (status >= 200 && status < 300) {
        const sent = new Set(batch.map((s) => s.id));
        this.save(this.load().filter((s) => !sent.has(s.id)));
        this.failures = 0;
        if (this.load().length) this.schedule(0);
      } else {
        this.schedule(RETRY_MS[Math.min(this.failures, RETRY_MS.length - 1)]);
        this.failures++;
      }
    } catch {
      /* Logging never breaks the app. */
    } finally {
      this.flushing = false;
    }
  }

  private schedule(delay: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }

  private load(): Stored[] {
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Stored[];
      }
      return raw === null && this.storage ? [] : this.memory;
    } catch {
      return this.memory;
    }
  }

  private save(stored: Stored[]): void {
    this.memory = stored;
    try {
      this.storage?.setItem(KEY, JSON.stringify(stored));
    } catch {
      /* Memory keeps the events until the page closes. */
    }
  }
}
