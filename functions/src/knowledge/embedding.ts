import { createHash } from 'node:crypto';
import { genkit } from 'genkit';
import { vertexAI } from '@genkit-ai/google-genai';
import type { EmbeddingMode } from './models/embedding-mode.js';
import type { EmbeddingConfig } from './models/embedding-config.js';
import type { EmbeddingConfigInput } from './models/embedding-config-input.js';
import type { EmbeddingProvider } from './models/embedding-provider.js';
import type { SingleTextEmbeddingProvider } from './models/single-text-embedding-provider.js';

export const MAX_EMBEDDING_INPUTS = 100;
export const MAX_EMBEDDING_TEXT_CHARS = 8_000;
export const MAX_EMBEDDING_BATCH_CHARS = 100_000;

export function createEmbeddingConfig(input: EmbeddingConfigInput): EmbeddingConfig {
  const projectId = requireText(input.projectId, 'projectId');
  const modelId = requireText(input.modelId, 'model');
  if (!modelId.toLowerCase().includes('embedding'))
    throw new Error('model must be a Vertex embedding model ID');
  const location = requireText(input.location, 'location');
  if (!Number.isSafeInteger(input.dimension) || input.dimension < 1 || input.dimension > 3072) {
    throw new Error('dimension must be a positive integer no greater than 3072');
  }
  if (input.documentMode !== 'RETRIEVAL_DOCUMENT' || input.queryMode !== 'RETRIEVAL_QUERY') {
    throw new Error('Embedding modes must be RETRIEVAL_DOCUMENT and RETRIEVAL_QUERY');
  }
  const identity = {
    provider: 'vertex' as const,
    projectId,
    modelId,
    dimension: input.dimension,
    documentMode: input.documentMode,
    queryMode: input.queryMode,
    location,
  };
  return {
    ...identity,
    configHash: createHash('sha256').update(JSON.stringify(identity)).digest('hex'),
  };
}

function canonicalizeEmbeddingConfig(config: EmbeddingConfig): EmbeddingConfig {
  const canonical = createEmbeddingConfig(config);
  if (config.configHash !== canonical.configHash)
    throw new Error('Embedding config hash does not match its settings');
  return Object.freeze(canonical);
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 256)
    throw new Error(`${label} must contain 1–256 characters`);
  return normalized;
}

export function validateEmbeddingInputs(texts: string[]): void {
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_EMBEDDING_INPUTS) {
    throw new Error(`texts must contain 1–${MAX_EMBEDDING_INPUTS} items`);
  }
  let total = 0;
  for (const [index, text] of texts.entries()) {
    if (typeof text !== 'string' || !text.trim())
      throw new Error(`text ${index} must be non-empty`);
    if (text.length > MAX_EMBEDDING_TEXT_CHARS)
      throw new Error(`text ${index} exceeds ${MAX_EMBEDDING_TEXT_CHARS} characters`);
    total += text.length;
  }
  if (total > MAX_EMBEDDING_BATCH_CHARS)
    throw new Error(`batch exceeds ${MAX_EMBEDDING_BATCH_CHARS} characters`);
}

export function validateEmbeddingVectors(
  vectors: number[][],
  expectedCount: number,
  dimension: number,
): number[][] {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) {
    throw new Error(
      `Provider returned ${Array.isArray(vectors) ? vectors.length : 'invalid'} vectors for ${expectedCount} inputs`,
    );
  }
  return vectors.map((vector, index) => {
    if (!Array.isArray(vector) || vector.length !== dimension) {
      throw new Error(
        `Vector ${index} has dimension ${Array.isArray(vector) ? vector.length : 'invalid'}; expected ${dimension}`,
      );
    }
    let squaredNorm = 0;
    for (const value of vector) {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new Error(`Vector ${index} contains a non-finite value`);
      squaredNorm += value * value;
    }
    if (!Number.isFinite(squaredNorm) || squaredNorm === 0)
      throw new Error(`Vector ${index} has zero or invalid norm`);
    return vector;
  });
}

/** Creates the server-side adapter. Tests may inject a fake provider; production uses Vertex AI. */
export function createEmbeddingAdapter(config: EmbeddingConfig, provider: EmbeddingProvider) {
  const canonicalConfig = canonicalizeEmbeddingConfig(config);
  return {
    config: canonicalConfig,
    async embedTexts(texts: string[], mode: EmbeddingMode): Promise<number[][]> {
      validateEmbeddingInputs(texts);
      if (mode !== 'document' && mode !== 'query')
        throw new Error('mode must be document or query');
      const taskType =
        mode === 'document' ? canonicalConfig.documentMode : canonicalConfig.queryMode;
      const vectors = await provider(texts, taskType, canonicalConfig);
      return validateEmbeddingVectors(vectors, texts.length, canonicalConfig.dimension);
    },
  };
}

export function createVertexEmbeddingAdapter(
  config: EmbeddingConfig,
  embedOne?: SingleTextEmbeddingProvider,
) {
  const canonicalConfig = canonicalizeEmbeddingConfig(config);
  const callOne = embedOne ?? createGenkitEmbeddingCall(canonicalConfig);
  return createEmbeddingAdapter(config, async (texts, taskType, activeConfig) => {
    const vectors: number[][] = [];
    for (const text of texts) {
      const vector = await callOne(text, taskType, activeConfig);
      vectors.push(...validateEmbeddingVectors([vector], 1, activeConfig.dimension));
    }
    return vectors;
  });
}

function createGenkitEmbeddingCall(config: EmbeddingConfig): SingleTextEmbeddingProvider {
  const ai = genkit({
    plugins: [vertexAI({ projectId: config.projectId, location: config.location })],
  });
  return async (text, taskType, activeConfig) => {
    // Gemini embedding requests accept one instance in this SDK path; keep each billable call explicit.
    const embeddings = await ai.embedMany({
      embedder: vertexAI.embedder(activeConfig.modelId as `${string}embedding${string}`),
      content: [text],
      options: {
        taskType,
        outputDimensionality: activeConfig.dimension,
        location: activeConfig.location,
      },
    });
    if (embeddings.length !== 1)
      throw new Error(`Provider returned ${embeddings.length} vectors for 1 input`);
    return embeddings[0].embedding;
  };
}
