import type { AiBudget } from './ai-budget.js';
import type { ProcedureModelOutput } from './procedure-model-output.js';
import type { ActorContext } from './actor-context.js';
import type { RetrievedChunk } from './retrieved-chunk.js';

export type ProcedureDependencies = {
  resolveActor(uid: string): Promise<ActorContext>;
  admitAiCall(
    actor: ActorContext,
    endpoint: 'procedure',
    input: string,
    now: Date,
  ): Promise<AiBudget>;
  retrieve(
    input: { question: string; limit: 3 },
    actor: ActorContext,
    signal?: AbortSignal,
  ): Promise<RetrievedChunk[]>;
  recheck(sources: RetrievedChunk[], actor: ActorContext): Promise<boolean>;
  generate(budget: AiBudget, prompt: string): Promise<string | ProcedureModelOutput>;
};
