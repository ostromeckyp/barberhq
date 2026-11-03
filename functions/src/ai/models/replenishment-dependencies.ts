import type { AiBudget } from './ai-budget.js';
import type { ReplenishmentRepository } from './replenishment-repository.js';
import type { ActorContext } from './actor-context.js';
import type { ReplenishmentGenerator } from './replenishment-generator.js';
import type { ShorthandCommands } from './shorthand-commands.js';
import type { ProductMatcher } from './product-matcher.js';

export type ReplenishmentDependencies = {
  resolveActor(uid: string): Promise<ActorContext>;
  admitAiCall(
    actor: ActorContext,
    endpoint: 'replenishment',
    message: string,
    now: Date,
  ): Promise<AiBudget>;
  repository: ReplenishmentRepository;
  generate: ReplenishmentGenerator;
  shorthand: ShorthandCommands;
  /** Optional second model turn for lines lookup left open; absent means no AI matching. */
  matchProducts?: ProductMatcher;
  /** Operational log; never receives message text. */
  log?: (event: string, data: Record<string, unknown>) => void;
};
