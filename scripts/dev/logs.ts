import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export interface LogQuery {
  uid: string;
  since: string;
  channel?: 'live' | 'preview' | 'local';
  source?: 'web' | 'functions';
}

const UNITS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

export function parseSince(since: string): number {
  const match = /^(\d+)([mhd])$/.exec(since);
  if (!match) throw new Error(`--since must look like 15m, 2h or 1d, got "${since}"`);
  return Number(match[1]) * UNITS[match[2]];
}

/** Cloud Logging filter for one user's browser and backend entries from a start time. */
export function buildLogFilter(query: LogQuery, now: () => Date = () => new Date()): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(query.uid)) throw new Error('Invalid --uid');
  const from = new Date(now().getTime() - parseSince(query.since)).toISOString();
  return [
    `jsonPayload.uid="${query.uid}"`,
    `timestamp>="${from}"`,
    ...(query.channel ? [`jsonPayload.channel="${query.channel}"`] : []),
    ...(query.source ? [`jsonPayload.source="${query.source}"`] : []),
  ].join(' AND ');
}

/** `HH:MM:SS.mmm source channel event outcome code durationMs details` (time in UTC). */
export function formatEntry(entry: unknown): string {
  const e = entry as { timestamp?: string; jsonPayload?: Record<string, unknown> };
  const p = e.jsonPayload ?? {};
  const time = e.timestamp ? e.timestamp.slice(11, 23) : '--:--:--.---';
  const text = (v: unknown) => (typeof v === 'string' && v ? v : '-');
  const duration = typeof p['durationMs'] === 'number' ? `${p['durationMs']}ms` : '-';
  const details =
    p['details'] && typeof p['details'] === 'object' ? JSON.stringify(p['details']) : '';
  return [
    time,
    text(p['source']),
    text(p['channel']),
    text(p['event']),
    text(p['outcome']),
    text(p['code']),
    duration,
    ...(details ? [details] : []),
  ].join(' ');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      uid: { type: 'string' },
      since: { type: 'string', default: '1h' },
      channel: { type: 'string' },
      source: { type: 'string' },
    },
  });
  if (!values.uid) throw new Error('Pass --uid <Firebase uid> [--since 2h] [--channel preview]');
  if (values.channel && !['live', 'preview', 'local'].includes(values.channel))
    throw new Error('--channel must be live, preview or local');
  if (values.source && !['web', 'functions'].includes(values.source))
    throw new Error('--source must be web or functions');
  const filter = buildLogFilter({
    uid: values.uid,
    since: values.since!,
    channel: values.channel as LogQuery['channel'],
    source: values.source as LogQuery['source'],
  });
  const result = spawnSync(
    'gcloud',
    [
      'logging',
      'read',
      filter,
      '--project',
      'notbad-6be95',
      '--order',
      'asc',
      '--format',
      'json',
      '--limit',
      '500',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  const entries = JSON.parse(result.stdout || '[]') as unknown[];
  for (const entry of entries) console.log(formatEntry(entry));
  if (!entries.length) console.log('No entries. Check the uid, --since and --channel.');
}
