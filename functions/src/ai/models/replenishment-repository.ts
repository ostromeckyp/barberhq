import type { ActorContext } from './actor-context.js';
import type { AiBudget } from './ai-budget.js';
import type { ReplenishmentContext } from './replenishment-context.js';

export type ReplenishmentRepository = {
  readContext(
    actor: ActorContext,
    salonId: string,
    budget: AiBudget,
  ): Promise<ReplenishmentContext>;
};
