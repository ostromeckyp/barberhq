import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ClientLog } from './client-log';

/**
 * First stack frames without the message line (messages may carry user content), one detail
 * per frame because each detail is capped at 120 characters.
 */
function frames(error: Error): Record<string, string> | undefined {
  const lines = (error.stack ?? '').split('\n').map((line) => line.trim());
  const message = error.message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 2);
  // V8 frames start with "at "; Safari and Firefox frames are "name@url" with no message line.
  const v8 = lines.some((line) => line.startsWith('at '));
  const kept = lines
    .filter((line) => (v8 ? line.startsWith('at ') : line.includes('@')))
    .filter((line) => !message.some((part) => line.includes(part)))
    .slice(0, 3);
  return kept.length
    ? Object.fromEntries(kept.map((line, i) => [`frame${i + 1}`, line]))
    : undefined;
}

/** Angular's default handling, plus one `client.error.unhandled` event per uncaught error. */
const REPEAT_MS = 5_000;
const MAX_PER_PAGE = 20;

@Injectable()
export class LoggingErrorHandler extends ErrorHandler {
  private readonly log = inject(ClientLog);
  private readonly lastSeen = new Map<string, number>();
  private recorded = 0;

  /** One entry per distinct error every 5 s, at most 20 per page, so a loop cannot flood. */
  private allowed(signature: string): boolean {
    const now = Date.now();
    const last = this.lastSeen.get(signature);
    if (this.recorded >= MAX_PER_PAGE || (last !== undefined && now - last < REPEAT_MS))
      return false;
    this.lastSeen.set(signature, now);
    this.recorded++;
    return true;
  }

  override handleError(error: unknown): void {
    super.handleError(error);
    try {
      const code = (error as { code?: unknown } | null)?.code;
      if (!(error instanceof Error)) {
        if (!this.allowed(`unknown:${String(code)}`)) return;
        this.log.record('client.error.unhandled', 'error', {
          code: typeof code === 'string' ? code : 'unknown',
        });
        return;
      }
      const stack = frames(error);
      if (!this.allowed(`${error.name}:${String(code)}:${stack?.['frame1'] ?? ''}`)) return;
      this.log.record('client.error.unhandled', 'error', {
        code: typeof code === 'string' ? code : error.name,
        ...(stack ? { details: stack } : {}),
      });
    } catch {
      /* Logging never breaks error handling. */
    }
  }
}
