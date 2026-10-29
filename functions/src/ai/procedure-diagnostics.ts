import { AiError, type AiErrorCode } from './budget.js';

export type ProcedurePhase = 'actor' | 'admission' | 'retrieval' | 'generation' | 'recheck';
export type ProcedurePhaseEvent = {
  stage: ProcedurePhase;
  state: 'start' | 'success' | 'error';
  attempt: 1 | 2;
  elapsedMs: number;
  code?: AiErrorCode | 'UNKNOWN';
};
export type ProcedurePhaseObserver = (event: ProcedurePhaseEvent) => void;

function notify(observer: ProcedurePhaseObserver | undefined, event: ProcedurePhaseEvent): void {
  try {
    observer?.(event);
  } catch {
    /* Diagnostics must not change the answer. */
  }
}

/** Only allowlisted metadata crosses the logging boundary. */
export async function observeProcedurePhase<T>(
  observer: ProcedurePhaseObserver | undefined,
  stage: ProcedurePhase,
  attempt: 1 | 2,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  notify(observer, { stage, state: 'start', attempt, elapsedMs: 0 });
  try {
    const result = await work();
    notify(observer, {
      stage,
      state: 'success',
      attempt,
      elapsedMs: Math.max(0, performance.now() - started),
    });
    return result;
  } catch (error) {
    notify(observer, {
      stage,
      state: 'error',
      attempt,
      elapsedMs: Math.max(0, performance.now() - started),
      code: error instanceof AiError ? error.code : 'UNKNOWN',
    });
    throw error;
  }
}
