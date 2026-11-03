import type { ActorContext } from './actor-context.js';
import type { AiBudget } from './ai-budget.js';
import type { TranscribeProvider } from './transcribe-provider.js';

export type OrderTranscriberDependencies = {
  resolveActor(uid: string): Promise<ActorContext>;
  /** Throws when the salon is not readable by the actor; runs before the quota is charged. */
  assertSalon(actor: ActorContext, salonId: string): Promise<void>;
  admitAiCall(
    actor: ActorContext,
    endpoint: 'transcription',
    input: string,
    now: Date,
  ): Promise<AiBudget>;
  transcribe: TranscribeProvider;
  /** Metadata-only logger; never receives transcript text or audio. */
  log?: (event: string, data: Record<string, unknown>) => void;
};
