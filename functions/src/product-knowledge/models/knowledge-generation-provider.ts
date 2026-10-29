import type { AiBudget } from '../../ai/models/ai-budget.js';

export type KnowledgeGenerationProvider = (
  budget: AiBudget,
  prompt: string,
  kind: 'aliases' | 'link',
) => Promise<unknown>;
