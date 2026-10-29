import type { procedureModelSchema } from '../schemas.js';

export type StructuredGenerationOptions = {
  model: string;
  prompt: string;
  abortSignal: AbortSignal;
  maxTurns: 1;
  tools: [];
  output: { format: 'json'; schema: typeof procedureModelSchema };
  config: {
    maxOutputTokens: 1024;
    thinkingConfig: { thinkingLevel: 'LOW'; includeThoughts: false };
  };
};
