import type { ProcedurePhaseEvent } from './procedure-phase-event.js';

export type ProcedurePhaseObserver = (event: ProcedurePhaseEvent) => void;
