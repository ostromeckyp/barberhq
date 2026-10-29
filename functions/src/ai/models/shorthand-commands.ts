import type { PrepareInput, ShorthandLearning } from '../../../../shared/contracts/ai/index.js';
import type { AiBudget } from './ai-budget.js';
import type { ActorContext } from './actor-context.js';
import type { ConfirmChoice } from './confirm-choice.js';
import type { IssueChoice } from './issue-choice.js';

export type ShorthandCommands = {
  issue(
    actor: ActorContext,
    input: PrepareInput,
    choices: IssueChoice[],
    budget: AiBudget,
    catalogRevision: number,
  ): Promise<Map<string, string>>;
  confirm(
    actor: ActorContext,
    input: PrepareInput,
    choices: ConfirmChoice[],
    budget: AiBudget,
  ): Promise<ShorthandLearning[]>;
};
