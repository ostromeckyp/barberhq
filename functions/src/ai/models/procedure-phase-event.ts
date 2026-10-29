import type { AiErrorCode } from './ai-error-code.js';
import type { ProcedurePhase } from './procedure-phase.js';

export type ProcedurePhaseEvent = {
  stage: ProcedurePhase;
  state: 'start' | 'success' | 'error';
  attempt: 1 | 2;
  elapsedMs: number;
  code?: AiErrorCode | 'UNKNOWN';
};
