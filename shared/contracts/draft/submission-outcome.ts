import type { ActiveConflict } from '../stock/active-conflict.js';
export type SubmissionOutcome =
  | { status: 'CREATED'; requestId: string }
  | { status: 'FAILED'; code: string; conflicts?: ActiveConflict[] }
  | { status: 'UNKNOWN' };
