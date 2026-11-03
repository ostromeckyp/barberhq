import { write } from 'firebase-functions/logger';
import type { LogSeverity } from './models/log-severity.js';

type Details = Record<string, string | number | boolean>;
type Log = (severity: LogSeverity, entry: Record<string, unknown>) => void;

const defaultLog: Log = (severity, entry) =>
  write({ severity, message: String(entry['event']), ...entry });

/**
 * Runs one background step and writes one entry with its outcome and duration. Errors are
 * logged by name only (messages may carry payload) and rethrown unchanged.
 */
export async function logStep<T>(
  event: string,
  run: () => Promise<T>,
  details: Details | ((result: T) => Details) = {},
  log: Log = defaultLog,
): Promise<T> {
  const started = Date.now();
  const emit = (severity: LogSeverity, entry: Record<string, unknown>) => {
    try {
      log(severity, {
        source: 'functions',
        event,
        durationMs: Date.now() - started,
        ...entry,
      });
    } catch {
      /* Logging never fails the step. */
    }
  };
  try {
    const result = await run();
    const kept = typeof details === 'function' ? details(result) : details;
    emit('INFO', { outcome: 'ok', ...(Object.keys(kept).length ? { details: kept } : {}) });
    return result;
  } catch (error) {
    const kept = typeof details === 'function' ? {} : details;
    emit('WARNING', {
      outcome: 'error',
      code: error instanceof Error ? error.name : 'unknown',
      ...(Object.keys(kept).length ? { details: kept } : {}),
    });
    throw error;
  }
}
