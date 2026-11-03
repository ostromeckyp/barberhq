import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ClientLog } from './client-log';

/**
 * First stack frames without the message line (messages may carry user content), one detail
 * per frame because each detail is capped at 120 characters.
 */
function frames(error: Error): Record<string, string> | undefined {
  const lines = (error.stack ?? '').split('\n').map((line) => line.trim());
  const message = error.message ? error.message.split('\n')[0] : null;
  const kept = lines
    .filter((line) => /^at\s|@/.test(line) && !(message && line.includes(message)))
    .slice(0, 3);
  return kept.length
    ? Object.fromEntries(kept.map((line, i) => [`frame${i + 1}`, line]))
    : undefined;
}

/** Angular's default handling, plus one `client.error.unhandled` event per uncaught error. */
@Injectable()
export class LoggingErrorHandler extends ErrorHandler {
  private readonly log = inject(ClientLog);

  override handleError(error: unknown): void {
    super.handleError(error);
    try {
      const code = (error as { code?: unknown } | null)?.code;
      if (!(error instanceof Error)) {
        this.log.record('client.error.unhandled', 'error', {
          code: typeof code === 'string' ? code : 'unknown',
        });
        return;
      }
      const stack = frames(error);
      this.log.record('client.error.unhandled', 'error', {
        code: typeof code === 'string' ? code : error.name,
        ...(stack ? { details: stack } : {}),
      });
    } catch {
      /* Logging never breaks error handling. */
    }
  }
}
