import { vertexAI } from '@genkit-ai/google-genai';
import type { ModelArgument } from 'genkit';
import { AiError } from './budget.js';
import { replenishmentReasoningConfig } from './replenishment-model.js';
import { createAiRuntime, runBudgetedModelTurn } from './runtime.js';
import { transcriptionInstruction } from './transcription-prompt.js';
import type { TranscribeProvider } from './models/transcribe-provider.js';

/** Codec parameters ("audio/webm;codecs=opus") are validated upstream but not sent to the provider. */
export function bareMimeType(mimeType: string): string {
  return (mimeType.split(';')[0] ?? '').trim().toLowerCase();
}

export function createTranscribeProvider(
  ai = createAiRuntime(replenishmentReasoningConfig),
  model: ModelArgument = vertexAI.model(replenishmentReasoningConfig.modelId),
): TranscribeProvider {
  return async (budget, { audio, mimeType, language }) => {
    const mime = bareMimeType(mimeType);
    const response = await runBudgetedModelTurn(budget, (abortSignal) =>
      ai.generate({
        model,
        maxTurns: 1,
        abortSignal,
        system: transcriptionInstruction(language),
        prompt: [
          { media: { url: `data:${mime};base64,${audio.toString('base64')}`, contentType: mime } },
          { text: 'Transcribe.' },
        ],
        config: { temperature: 0, maxOutputTokens: 512 },
      }),
    );
    if (typeof response.text !== 'string') throw new AiError('PROVIDER_UNAVAILABLE');
    return response.text;
  };
}
