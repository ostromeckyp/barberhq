import { write } from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import type { LogSeverity } from '../logging/models/log-severity.js';
import type { RouterOptions } from './models/router-options.js';

interface RoutedOperation {
  run(request: CallableRequest): unknown;
}

// HttpsError messages that are codes (e.g. RATE_LIMITED) are safe to log; free text is not.
const REASON = /^[A-Z][A-Z0-9_]{1,63}$/;
const defaultLog = (severity: LogSeverity, entry: Record<string, unknown>) =>
  write({ severity, message: String(entry['event']), ...entry });

/**
 * Dispatches `{ op, input }` to an existing callable through its `run` method. The handler gets
 * the original request with only `data` replaced, so auth, App Check and `rawRequest` (which the
 * knowledge callables read for token re-verification) are unchanged. Every call writes one log
 * entry with the op, outcome, error code and duration; never the input or result.
 */
export function createRouter(ops: Record<string, RoutedOperation>, options?: RouterOptions) {
  const service = options?.service ?? 'commands';
  const log = options?.log ?? defaultLog;
  return async (request: CallableRequest) => {
    const started = Date.now();
    const uid = request.auth?.uid;
    const record = (name: string, error?: unknown) => {
      const entry: Record<string, unknown> = {
        source: 'functions',
        event: `${service}.${name}`,
        outcome: error === undefined ? 'ok' : 'error',
        durationMs: Date.now() - started,
        ...(uid ? { uid } : {}),
      };
      let severity: LogSeverity = 'INFO';
      if (error instanceof HttpsError) {
        severity = 'WARNING';
        entry['code'] = error.code;
        if (REASON.test(error.message)) entry['details'] = { reason: error.message };
      } else if (error !== undefined) {
        severity = 'ERROR';
        entry['code'] = 'internal';
        if (error instanceof Error) entry['details'] = { name: error.name };
      }
      try {
        log(severity, entry);
      } catch {
        /* Logging never fails an operation. */
      }
    };
    const data: unknown = request.data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      const error = new HttpsError('invalid-argument', 'INVALID_OPERATION');
      record('invalid', error);
      throw error;
    }
    const { op, input } = data as { op?: unknown; input?: unknown };
    // `input` must be present; `input: null` stays valid for ops that take no arguments.
    if (typeof op !== 'string' || !Object.hasOwn(ops, op) || !Object.hasOwn(data, 'input')) {
      const error = new HttpsError('invalid-argument', 'INVALID_OPERATION');
      record('invalid', error);
      throw error;
    }
    try {
      const result = await ops[op].run({ ...request, data: input });
      record(op);
      return result;
    } catch (error) {
      record(op, error ?? new Error('unknown'));
      throw error;
    }
  };
}
