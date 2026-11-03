import { describe, expect, it, vi } from 'vitest';
import { createClientLogHandler } from '../../functions/src/logging/client-log.ts';

const ORIGIN = 'https://notbad-6be95.web.app';
const event = (extra: Record<string, unknown> = {}) => ({
  event: 'request.submit.outcome',
  outcome: 'ok',
  sessionId: 's-1',
  build: 'abc1234',
  channel: 'live',
  clientTime: '2026-11-03T17:00:00.000Z',
  ...extra,
});

function setup(verified: string | null = 'u1') {
  const write = vi.fn();
  const verifyAuth = vi.fn(async () => verified);
  const handler = createClientLogHandler({ origins: [ORIGIN], verifyAuth, write });
  const call = async (request: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  }) => {
    const response = {
      code: 0,
      headers: {} as Record<string, string>,
      status(code: number) {
        this.code = code;
        return this;
      },
      set(name: string, value: string) {
        this.headers[name] = value;
        return this;
      },
      send() {
        return this;
      },
      end() {
        return this;
      },
    };
    await handler(
      {
        method: request.method ?? 'POST',
        headers: {
          origin: ORIGIN,
          authorization: 'Bearer token',
          'user-agent': 'UA/1',
          ...request.headers,
        },
        body: request.body ?? { events: [event()] },
      },
      response,
    );
    return response;
  };
  return { call, write, verifyAuth };
}

describe('clientLog', () => {
  it('answers a preflight from an allowed origin', async () => {
    const { call } = setup();
    const response = await call({ method: 'OPTIONS' });
    expect(response.code).toBe(204);
    expect(response.headers['Access-Control-Allow-Origin']).toBe(ORIGIN);
  });

  it('rejects a foreign origin', async () => {
    const { call, write } = setup();
    expect((await call({ headers: { origin: 'https://evil.example' } })).code).toBe(403);
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects other methods', async () => {
    expect((await setup().call({ method: 'GET' })).code).toBe(405);
  });

  it('rejects a missing bearer token', async () => {
    const { call, write } = setup();
    expect((await call({ headers: { authorization: '' } })).code).toBe(401);
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const { call, write } = setup(null);
    expect((await call({})).code).toBe(401);
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects a body that is not a list of events', async () => {
    expect((await setup().call({ body: { events: 'x' } })).code).toBe(400);
  });

  it('rejects more than 50 events', async () => {
    const events = Array.from({ length: 51 }, () => event());
    expect((await setup().call({ body: { events } })).code).toBe(400);
  });

  it('writes each event with the verified uid, not the claimed one', async () => {
    const { call, write } = setup('u1');
    const response = await call({ body: { events: [event({ uid: 'spoof' })] } });
    expect(response.code).toBe(204);
    expect(write).toHaveBeenCalledWith(
      'INFO',
      expect.objectContaining({ source: 'web', uid: 'u1', userAgent: 'UA/1' }),
    );
    expect(write.mock.calls[0][1].uid).toBe('u1');
  });

  it('skips invalid events and keeps the valid ones', async () => {
    const { call, write } = setup();
    await call({ body: { events: [event(), { event: 'Bad' }, event()] } });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('maps severity from the event', async () => {
    const { call, write } = setup();
    await call({
      body: {
        events: [
          event({ event: 'client.error.unhandled', outcome: 'error' }),
          event({ outcome: 'error' }),
        ],
      },
    });
    expect(write.mock.calls.map((c) => c[0])).toEqual(['ERROR', 'WARNING']);
  });
});
