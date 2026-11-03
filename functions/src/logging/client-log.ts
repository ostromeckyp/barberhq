import { getAuth } from 'firebase-admin/auth';
import { write } from 'firebase-functions/logger';
import { onRequest } from 'firebase-functions/v2/https';
import { maxLogBatch, sanitizeLogEvent } from '../../../shared/contracts/logging/index.js';
import { CLOUD } from '../cloud-config.js';
import type { ClientLogDeps } from './models/client-log-deps.js';
import type { ClientLogRequest } from './models/client-log-request.js';
import type { ClientLogResponse } from './models/client-log-response.js';
import type { LogSeverity } from './models/log-severity.js';

const header = (request: ClientLogRequest, name: string): string | undefined => {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
};
const deny = (response: ClientLogResponse, status: number, code: string) =>
  response.status(status).send({ error: code });

/**
 * Receives batches of browser log events. Not a callable: callables enforce App Check, and the
 * browser must be able to report even when App Check is the step that hangs.
 */
export function createClientLogHandler(deps: ClientLogDeps) {
  const allowed = new Set(deps.origins.filter(Boolean));
  return async (request: ClientLogRequest, response: ClientLogResponse): Promise<void> => {
    response.set('Cache-Control', 'no-store').set('Vary', 'Origin');
    const origin = header(request, 'origin');
    if (origin && !allowed.has(origin)) {
      deny(response, 403, 'FORBIDDEN');
      return;
    }
    if (origin) response.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      if (!origin) {
        deny(response, 403, 'FORBIDDEN');
        return;
      }
      response
        .set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        .set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        .set('Access-Control-Max-Age', '3600')
        .status(204)
        .end();
      return;
    }
    if (request.method !== 'POST') {
      deny(response, 405, 'METHOD_NOT_ALLOWED');
      return;
    }
    const bearer = header(request, 'authorization');
    if (!bearer?.startsWith('Bearer ') || bearer.length <= 7) {
      deny(response, 401, 'UNAUTHENTICATED');
      return;
    }
    const uid = await deps.verifyAuth(bearer.slice(7));
    if (!uid) {
      deny(response, 401, 'UNAUTHENTICATED');
      return;
    }
    const body = request.body as { events?: unknown } | null;
    const events = body && typeof body === 'object' ? body.events : undefined;
    if (!Array.isArray(events) || events.length > maxLogBatch) {
      deny(response, 400, 'INVALID_ARGUMENT');
      return;
    }
    const userAgent = header(request, 'user-agent')?.slice(0, 300);
    for (const raw of events) {
      const event = sanitizeLogEvent(raw);
      if (!event) continue;
      const severity: LogSeverity = event.event.startsWith('client.error')
        ? 'ERROR'
        : event.outcome === 'error'
          ? 'WARNING'
          : 'INFO';
      deps.write(severity, { message: event.event, source: 'web', ...event, uid, userAgent });
    }
    response.status(204).end();
  };
}

export function clientLogFunction() {
  return onRequest(
    { region: 'europe-west1', maxInstances: 2, memory: '256MiB' },
    async (request, response) => {
      const origins = [...CLOUD.allowedOrigins];
      if (process.env.FUNCTIONS_EMULATOR === 'true')
        origins.push('http://localhost:4200', 'http://127.0.0.1:4200');
      await createClientLogHandler({
        origins,
        verifyAuth: async (token) => {
          try {
            return (await getAuth().verifyIdToken(token)).uid;
          } catch {
            return null;
          }
        },
        write: (severity, entry) => write({ severity, ...entry }),
      })(request as unknown as ClientLogRequest, response as unknown as ClientLogResponse);
    },
  );
}
