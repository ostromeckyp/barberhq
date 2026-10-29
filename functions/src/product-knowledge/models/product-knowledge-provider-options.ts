import type { z } from 'genkit';

export type ProductKnowledgeProviderOptions = {
  prompt: string;
  abortSignal: AbortSignal;
  maxTurns: 1;
  tools: [];
  model: string;
  output: { format: 'json'; schema: z.ZodType };
  config: {
    maxOutputTokens: 2048;
    thinkingConfig: { thinkingLevel: 'LOW'; includeThoughts: false };
  };
};
