import type { ClientLogEvent } from './client-log-event.js';

const EVENT = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+){1,4}$/;
const CODE = /^[A-Za-z0-9_./-]{1,64}$/;
const DETAIL_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
const CHANNELS = new Set(['live', 'preview', 'local']);
const MAX_DETAILS = 12;
const MAX_TEXT = 120;
const MAX_DURATION_MS = 3_600_000;

const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;

function details(raw: unknown): ClientLogEvent['details'] {
  if (!record(raw)) return undefined;
  const kept: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Object.keys(kept).length === MAX_DETAILS) break;
    if (!DETAIL_KEY.test(key)) continue;
    if (typeof value === 'string') kept[key] = value.slice(0, MAX_TEXT);
    else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
      kept[key] = value;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/**
 * Keeps only the allow-listed fields of a browser log event, or returns `null` when it is not
 * one. Used by the browser before storing and by `clientLog` before writing.
 */
export function sanitizeLogEvent(raw: unknown): ClientLogEvent | null {
  if (!record(raw)) return null;
  const { event, outcome, sessionId, build, channel, clientTime } = raw;
  if (typeof event !== 'string' || !EVENT.test(event)) return null;
  if (outcome !== 'ok' && outcome !== 'error') return null;
  const session = text(sessionId, 64);
  const stamp = text(build, 40);
  const time = text(clientTime, 40);
  if (!session || !stamp || !time || typeof channel !== 'string' || !CHANNELS.has(channel))
    return null;
  const result: ClientLogEvent = {
    event,
    outcome,
    sessionId: session,
    build: stamp,
    channel: channel as ClientLogEvent['channel'],
    clientTime: time,
  };
  if (typeof raw['code'] === 'string' && CODE.test(raw['code'])) result.code = raw['code'];
  const duration = raw['durationMs'];
  if (typeof duration === 'number' && duration >= 0 && duration <= MAX_DURATION_MS)
    result.durationMs = Math.round(duration);
  if (raw['role'] === 'HQ' || raw['role'] === 'SALON') result.role = raw['role'];
  const businessId = text(raw['businessId'], 120);
  if (businessId) result.businessId = businessId;
  const salonId = text(raw['salonId'], 120);
  if (salonId) result.salonId = salonId;
  const kept = details(raw['details']);
  if (kept) result.details = kept;
  return result;
}
