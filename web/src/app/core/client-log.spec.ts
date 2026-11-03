import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ClientLogEvent } from '../../../../shared/contracts/logging/index';
import { CLIENT_LOG_PORT, CLIENT_LOG_STORAGE, ClientLog, type ClientLogPort } from './client-log';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

let storage: MemoryStorage;
let port: { [K in keyof ClientLogPort]: ReturnType<typeof vi.fn> };
let sent: ClientLogEvent[][];

function setup() {
  TestBed.configureTestingModule({
    providers: [
      { provide: CLIENT_LOG_STORAGE, useValue: storage },
      { provide: CLIENT_LOG_PORT, useValue: port },
    ],
  });
  return TestBed.inject(ClientLog);
}
const stored = () =>
  JSON.parse(storage.getItem('barberhq.clientLog.v1') ?? '[]') as { event: ClientLogEvent }[];

beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  sent = [];
  port = {
    uid: vi.fn(() => 'u1'),
    token: vi.fn(async () => 'id-token'),
    online: vi.fn(() => true),
    channel: vi.fn(() => 'preview'),
    send: vi.fn(async (events: ClientLogEvent[]) => {
      sent.push(events);
      return 204;
    }),
  };
});
afterEach(() => {
  vi.useRealTimers();
  TestBed.resetTestingModule();
});

it('stores an event and sends it with the token after 5 s', async () => {
  const log = setup();
  log.record('dictation.start');
  expect(stored()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(4_900);
  expect(port.send).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(200);
  expect(port.send).toHaveBeenCalledWith(expect.any(Array), 'id-token');
  expect(sent[0][0]).toMatchObject({
    event: 'dictation.start',
    outcome: 'ok',
    channel: 'preview',
    build: 'local',
  });
  expect(sent[0][0].sessionId).toMatch(/.+/);
  expect(stored()).toHaveLength(0);
});

it('sends right away at 20 events', async () => {
  const log = setup();
  for (let i = 0; i < 20; i++) log.record('request.list.load');
  await vi.advanceTimersByTimeAsync(0);
  expect(sent[0]).toHaveLength(20);
});

it('keeps events while offline and sends them when the network is back', async () => {
  port.online.mockReturnValue(false);
  const log = setup();
  log.record('request.submit.queued');
  await vi.advanceTimersByTimeAsync(10_000);
  expect(port.send).not.toHaveBeenCalled();
  expect(stored()).toHaveLength(1);
  port.online.mockReturnValue(true);
  window.dispatchEvent(new Event('online'));
  await vi.advanceTimersByTimeAsync(0);
  expect(sent[0][0].event).toBe('request.submit.queued');
  expect(stored()).toHaveLength(0);
});

it('keeps events while nobody is signed in', async () => {
  port.token.mockResolvedValue(null);
  const log = setup();
  log.record('session.signIn.failed', 'error', { code: 'auth/wrong-password' });
  await vi.advanceTimersByTimeAsync(10_000);
  expect(port.send).not.toHaveBeenCalled();
  expect(stored()).toHaveLength(1);
});

it('keeps events after a failed send and retries after 30 s', async () => {
  port.send.mockResolvedValueOnce(500);
  const log = setup();
  log.record('dictation.start');
  await vi.advanceTimersByTimeAsync(5_000);
  expect(port.send).toHaveBeenCalledTimes(1);
  expect(stored()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(29_000);
  expect(port.send).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1_000);
  expect(port.send).toHaveBeenCalledTimes(2);
  expect(stored()).toHaveLength(0);
});

it('keeps events when the request itself throws', async () => {
  port.send.mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const log = setup();
  log.record('dictation.start');
  await vi.advanceTimersByTimeAsync(5_000);
  expect(stored()).toHaveLength(1);
});

it('keeps only the newest 500 events', () => {
  port.online.mockReturnValue(false);
  const log = setup();
  for (let i = 0; i < 501; i++) log.record('request.list.load', 'ok', { details: { i } });
  const events = stored();
  expect(events).toHaveLength(500);
  expect(events[0].event.details).toEqual({ i: 1 });
});

it('never stores non-scalar details', () => {
  port.online.mockReturnValue(false);
  const log = setup();
  log.record('dictation.stop', 'ok', {
    details: { bytes: 10, text: { nested: 'x' } as unknown as string },
  });
  expect(stored()[0].event.details).toEqual({ bytes: 10 });
});

it('adds the session context to later events', () => {
  port.online.mockReturnValue(false);
  const log = setup();
  log.setContext({ role: 'SALON', businessId: 'b1', salonId: 's1' });
  log.record('request.prepare.result');
  expect(stored()[0].event).toMatchObject({ role: 'SALON', businessId: 'b1', salonId: 's1' });
});

it('sends on hiding the page', async () => {
  const log = setup();
  log.record('dictation.start');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.advanceTimersByTimeAsync(0);
  expect(port.send).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

it('records a step with its duration and rethrows the code of a failure', async () => {
  port.online.mockReturnValue(false);
  const log = setup();
  await expect(log.step('pdf.open', async () => 'ok')).resolves.toBe('ok');
  await expect(
    log.step('knowledge.upload', async () => {
      throw { code: 'UPLOAD_FAILED' };
    }),
  ).rejects.toEqual({ code: 'UPLOAD_FAILED' });
  const [ok, failed] = stored().map((s) => s.event);
  expect(ok).toMatchObject({ event: 'pdf.open', outcome: 'ok' });
  expect(typeof ok.durationMs).toBe('number');
  expect(failed).toMatchObject({
    event: 'knowledge.upload',
    outcome: 'error',
    code: 'UPLOAD_FAILED',
  });
});

it('keeps working when storage throws', async () => {
  storage.setItem = () => {
    throw new Error('quota');
  };
  storage.getItem = () => {
    throw new Error('blocked');
  };
  const log = setup();
  expect(() => log.record('dictation.start')).not.toThrow();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(sent[0][0].event).toBe('dictation.start');
});

it('never sends stored events of another user and drops them once someone else signs in', async () => {
  port.online.mockReturnValue(false);
  const log = setup();
  log.record('dictation.start');
  port.uid.mockReturnValue(null);
  log.record('session.signIn.failed', 'error', { code: 'auth/wrong-password' });
  port.uid.mockReturnValue('u2');
  port.online.mockReturnValue(true);
  await log.flush();
  expect(sent).toHaveLength(1);
  expect(sent[0].map((e) => e.event)).toEqual(['session.signIn.failed']);
  expect(stored()).toHaveLength(0);
});

it('keeps the retry backoff when the buffer is full', async () => {
  port.send.mockResolvedValue(500);
  const log = setup();
  for (let i = 0; i < 20; i++) log.record('request.list.load');
  await vi.advanceTimersByTimeAsync(0);
  expect(port.send).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 10; i++) log.record('call.submitRequest');
  await vi.advanceTimersByTimeAsync(1_000);
  expect(port.send).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(port.send).toHaveBeenCalledTimes(2);
});
