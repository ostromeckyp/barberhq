import type { AiBudget } from './ai-budget.js';
import type { ReplenishmentRepository } from './replenishment-repository.js';
import type { ActorContext } from './actor-context.js';
import type { ReplenishmentGenerator } from './replenishment-generator.js';
import type { ShorthandCommands } from './shorthand-commands.js';

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
};
