import type { CitedStep } from './cited-step.js';
import type { SourceSection } from '../knowledge/source-section.js';
export type ProcedureResult =
  | { status: 'ANSWER'; steps: CitedStep[]; sources: SourceSection[]; missingInformation: string[] }
  | { status: 'NEEDS_CLARIFICATION'; question: string; sources: [] }
  | { status: 'INSUFFICIENT_EVIDENCE'; message: string; sources: [] };
