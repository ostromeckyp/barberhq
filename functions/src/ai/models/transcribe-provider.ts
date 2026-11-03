import type { AiBudget } from './ai-budget.js';
import type { TranscribeRequest } from './transcribe-request.js';

/** Provider seam: returns the raw transcript text of the audio. */
export type TranscribeProvider = (budget: AiBudget, request: TranscribeRequest) => Promise<string>;
