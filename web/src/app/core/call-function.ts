import { httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import { aiOps } from '../../../../shared/contracts/functions/index';
import type { AiOp, CommandOp } from '../../../../shared/contracts/functions/index';

type CallObserver = (
  op: string,
  outcome: 'ok' | 'error',
  durationMs: number,
  code?: string,
  reason?: string,
) => void;
let observer: CallObserver | null = null;
// Server messages that are codes (e.g. RATE_LIMITED) are safe to report; free text is not.
const REASON = /^[A-Z][A-Z0-9_]{1,63}$/;

/** Registers the one listener told about every callable call (set by `ClientLog`). */
export function setCallObserver(next: CallObserver | null): void {
  observer = next;
}

function report(op: string, started: number, error?: unknown): void {
  try {
    const failure = error as { code?: unknown; message?: unknown } | undefined;
    const code = typeof failure?.code === 'string' ? failure.code : undefined;
    const message = typeof failure?.message === 'string' ? failure.message : '';
    observer?.(
      op,
      error === undefined ? 'ok' : 'error',
      performance.now() - started,
      error === undefined ? undefined : (code ?? 'unknown'),
      REASON.test(message) ? message : undefined,
    );
  } catch {
    /* Logging never breaks a call. */
  }
}

/**
 * Calls one operation of the `commands` or `ai` callable. Waits for App Check first, so no
 * callable goes out without a token. Errors from the callable propagate unchanged.
 */
export async function callFunction<I, O>(
  firebase: { functions: Functions; appCheck: () => Promise<unknown> },
  op: CommandOp | AiOp,
  input: I,
): Promise<O> {
  const started = performance.now();
  try {
    await firebase.appCheck();
    const name = (aiOps as readonly string[]).includes(op) ? 'ai' : 'commands';
    const response = await httpsCallable<{ op: CommandOp | AiOp; input: I }, O>(
      firebase.functions,
      name,
    )({ op, input });
    report(op, started);
    return response.data;
  } catch (error) {
    report(op, started, error ?? new Error('unknown'));
    throw error;
  }
}
