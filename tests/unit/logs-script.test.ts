import { describe, expect, it } from 'vitest';
import { buildLogFilter, formatEntry, parseSince } from '../../scripts/dev/logs.ts';

const now = () => new Date('2026-11-03T18:00:00.000Z');

describe('logs script', () => {
  it('parses minutes, hours and days', () => {
    expect(parseSince('15m')).toBe(15 * 60_000);
    expect(parseSince('2h')).toBe(2 * 3_600_000);
    expect(parseSince('1d')).toBe(86_400_000);
    expect(() => parseSince('soon')).toThrow();
  });

  it('filters one user from a start time', () => {
    expect(buildLogFilter({ uid: 'u1', since: '2h' }, now)).toBe(
      'jsonPayload.uid="u1" AND timestamp>="2026-11-03T16:00:00.000Z"',
    );
  });

  it('adds channel and source when given', () => {
    expect(
      buildLogFilter({ uid: 'u1', since: '15m', channel: 'preview', source: 'web' }, now),
    ).toBe(
      'jsonPayload.uid="u1" AND timestamp>="2026-11-03T17:45:00.000Z" AND jsonPayload.channel="preview" AND jsonPayload.source="web"',
    );
  });

  it('rejects a uid that would break the filter', () => {
    expect(() => buildLogFilter({ uid: 'u1" OR 1', since: '1h' }, now)).toThrow();
  });

  it('formats one entry per line', () => {
    expect(
      formatEntry({
        timestamp: '2026-11-03T17:01:02.345Z',
        jsonPayload: {
          source: 'web',
          channel: 'preview',
          event: 'dictation.stop',
          outcome: 'ok',
          durationMs: 1200,
          details: { bytes: 76121 },
        },
      }),
    ).toBe('17:01:02.345 web preview dictation.stop ok - 1200ms {"bytes":76121}');
  });

  it('formats a backend entry without details or channel', () => {
    expect(
      formatEntry({
        timestamp: '2026-11-03T17:01:03.000Z',
        jsonPayload: {
          source: 'functions',
          event: 'ai.transcribeOrder',
          outcome: 'error',
          code: 'deadline-exceeded',
          durationMs: 25000,
        },
      }),
    ).toBe('17:01:03.000 functions - ai.transcribeOrder error deadline-exceeded 25000ms');
  });
});
