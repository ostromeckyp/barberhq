import type { PrepareInput } from '../../../../shared/contracts/ai/index.js';
import type { AiBudget } from './ai-budget.js';
import type { ReplenishmentTools } from './replenishment-tools.js';

export type ReplenishmentGenerator = (
  budget: AiBudget,
  input: PrepareInput,
  tools: ReplenishmentTools,
) => Promise<unknown>;
