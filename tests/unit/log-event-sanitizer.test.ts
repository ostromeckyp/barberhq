import { describe, expect, it } from 'vitest';
import { maxLogBatch, sanitizeLogEvent } from '../../shared/contracts/logging/index.ts';

const valid = {
  event: 'request.submit.outcome',
  outcome: 'ok',
  code: 'SUBMITTED',
  durationMs: 120,
  sessionId: '6f1c2a8e-1b7d-4c55-9f2e-0a1b2c3d4e5f',
  build: 'abc1234',
  channel: 'preview',
  clientTime: '2026-11-03T17:00:00.000Z',
  role: 'SALON',
  businessId: 'b1',
  salonId: 's1',
  details: { bytes: 1024, mimeType: 'audio/webm', retried: false },
};

describe('sanitizeLogEvent', () => {
  it('keeps a valid event unchanged', () => {
    expect(sanitizeLogEvent(valid)).toEqual(valid);
  });

  it('drops unknown top-level fields such as a claimed uid or email', () => {
    const result = sanitizeLogEvent({ ...valid, uid: 'x', email: 'a@b.c' });
    expect(result).not.toHaveProperty('uid');
    expect(result).not.toHaveProperty('email');
  });

  for (const [name, patch] of [
    ['a malformed event name', { event: 'Bad Name' }],
    ['a single-segment event name', { event: 'request' }],
    ['an unknown outcome', { outcome: 'maybe' }],
    ['a missing session id', { sessionId: '' }],
    ['an unknown channel', { channel: 'staging' }],
  ] as const) {
    it(`rejects ${name}`, () => {
      expect(sanitizeLogEvent({ ...valid, ...patch })).toBeNull();
    });
  }

  it('rejects non-objects', () => {
    expect(sanitizeLogEvent('x')).toBeNull();
    expect(sanitizeLogEvent(null)).toBeNull();
    expect(sanitizeLogEvent([valid])).toBeNull();
  });

  it('trims long detail strings to 120 characters', () => {
    const result = sanitizeLogEvent({ ...valid, details: { text: 'x'.repeat(500) } });
    expect((result?.details?.['text'] as string).length).toBe(120);
  });

  it('drops non-scalar detail values', () => {
    const result = sanitizeLogEvent({ ...valid, details: { nested: { a: 1 }, list: [1], n: 2 } });
    expect(result?.details).toEqual({ n: 2 });
  });

  it('keeps at most 12 detail keys', () => {
    const details = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeLogEvent({ ...valid, details })?.details ?? {})).toHaveLength(12);
  });

  it('drops detail keys that are not plain identifiers', () => {
    const result = sanitizeLogEvent({ ...valid, details: { 'a b': 1, ok: 1 } });
    expect(result?.details).toEqual({ ok: 1 });
  });

  it('drops an out-of-range duration', () => {
    expect(sanitizeLogEvent({ ...valid, durationMs: -1 })).not.toHaveProperty('durationMs');
    expect(sanitizeLogEvent({ ...valid, durationMs: 3_600_001 })).not.toHaveProperty('durationMs');
  });

  it('drops a code with unexpected characters', () => {
    expect(sanitizeLogEvent({ ...valid, code: 'has space' })).not.toHaveProperty('code');
  });

  it('drops an unknown role', () => {
    expect(sanitizeLogEvent({ ...valid, role: 'ADMIN' })).not.toHaveProperty('role');
  });

  it('limits a batch to 50 events', () => {
    expect(maxLogBatch).toBe(50);
  });
});
