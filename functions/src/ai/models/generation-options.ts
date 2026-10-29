export type GenerationOptions = {
  model: string;
  prompt: string;
  abortSignal: AbortSignal;
  maxTurns: 1;
  tools: [];
  config: {
    maxOutputTokens: number;
    thinkingConfig: { thinkingLevel: 'LOW'; includeThoughts: false };
  };
};
