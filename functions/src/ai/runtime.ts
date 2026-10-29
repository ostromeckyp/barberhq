import { GenkitError, genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';
import { AiError, consumeModelTurn, runWithinBudget, type AiBudget } from './budget.js';
import {
  parseProcedureModelOutput,
  procedureModelSchema,
  type ProcedureModelOutput,
} from './schemas.js';

export type ReasoningConfig = {
  provider: 'vertex';
  projectId: string;
  location: string;
  modelId: string;
};
type GenerationOptions = {
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
export type GenerationProvider = (options: GenerationOptions) => Promise<{ text: string }>;

export async function runBudgetedModelTurn<T>(
  budget: AiBudget,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  consumeModelTurn(budget);
  try {
    return await runWithinBudget(budget, work);
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError('PROVIDER_UNAVAILABLE');
  }
}

function validate(config: ReasoningConfig): void {
  if (
    config.provider !== 'vertex' ||
    config.projectId !== 'notbad-6be95' ||
    config.location !== 'eu' ||
    !['gemini-3.8-flash', 'gemini-3.5-flash-lite'].includes(config.modelId)
  )
    throw new AiError('INVALID_CONFIG');
}

export function createAiRuntime(config: ReasoningConfig) {
  validate(config);
  return genkit({
    plugins: [vertexAI({ projectId: config.projectId, location: config.location })],
  });
}

/** One explicit Genkit call is one model turn. Tools run separately through consumeToolCall. */
export function createBudgetedGenerator(config: ReasoningConfig, provider?: GenerationProvider) {
  validate(config);
  const generate: GenerationProvider =
    provider ??
    (async (options) => {
      const ai = createAiRuntime(config);
      const response = await ai.generate({ ...options, model: vertexAI.model(config.modelId) });
      return { text: response.text };
    });
  return async (budget: AiBudget, prompt: string): Promise<string> => {
    const result = await runBudgetedModelTurn(budget, (abortSignal) =>
      generate({
        model: `vertexai/${config.modelId}`,
        prompt,
        abortSignal,
        maxTurns: 1,
        tools: [],
        config: {
          maxOutputTokens: 256,
          thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
        },
      }),
    );
    if (typeof result.text !== 'string') throw new AiError('PROVIDER_UNAVAILABLE');
    return result.text;
  };
}

type StructuredGenerationOptions = {
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
export type StructuredGenerationProvider = (
  options: StructuredGenerationOptions,
) => Promise<{ output: unknown }>;

function waitForCapacity(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AiError('TIMEOUT'));
    const abort = () => {
      clearTimeout(timer);
      reject(new AiError('TIMEOUT'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Procedure-specific output budget and Genkit schema; AI-0 text generator remains unchanged. */
export function createStructuredProcedureGenerator(
  config: ReasoningConfig,
  provider?: StructuredGenerationProvider,
) {
  validate(config);
  const generate: StructuredGenerationProvider =
    provider ??
    (async (options) => {
      const ai = createAiRuntime(config);
      const response = await ai.generate({ ...options, model: vertexAI.model(config.modelId) });
      return { output: response.output };
    });
  return async (budget: AiBudget, prompt: string): Promise<ProcedureModelOutput> => {
    const result = await runBudgetedModelTurn(budget, async (abortSignal) => {
      const options: StructuredGenerationOptions = {
        model: `vertexai/${config.modelId}`,
        prompt,
        abortSignal,
        maxTurns: 1,
        tools: [],
        output: { format: 'json', schema: procedureModelSchema },
        config: {
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false },
        },
      };
      try {
        return await generate(options);
      } catch (error) {
        if (
          !(error instanceof GenkitError) ||
          error.status !== 'RESOURCE_EXHAUSTED' ||
          budget.modelTurnsRemaining <= 0
        )
          throw error;
        const retryAfterMs = error.responseMetadata?.retryAfterMs;
        const delayMs = Math.max(
          1_000 + Math.floor(Math.random() * 1_000),
          typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) ? retryAfterMs : 0,
        );
        // Never shorten a provider hint that cannot fit even a fresh 25-second budget.
        if (delayMs >= 25_000) throw error;
        await waitForCapacity(delayMs, abortSignal);
        // The single retry shares the original deadline and consumes its own model turn.
        consumeModelTurn(budget);
        return generate(options);
      }
    });
    return parseProcedureModelOutput(result.output);
  };
}
