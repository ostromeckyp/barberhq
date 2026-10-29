import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createEmbeddingConfig,
  createVertexEmbeddingAdapter,
  validateEmbeddingVectors,
} from '../knowledge/embedding.js';
import { knowledgeDataConnectors, knowledgeRuntimeConfig } from '../knowledge/runtime.js';
import { knowledgeKinds } from '../../../shared/knowledge-metadata.js';
import { AiError } from './budget.js';
import { createSqlProcedureRepository } from './procedure-repository.js';
import type { ActorContext } from './models/actor-context.js';
import type { RetrievedChunk } from './models/retrieved-chunk.js';
import type { RagRetrievalConfig } from './models/rag-retrieval-config.js';
import type { RetrievalEmbedding } from './models/retrieval-embedding.js';
import type { RetrievalRepository } from './models/retrieval-repository.js';

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export function parseRagRetrievalConfig(value: unknown): RagRetrievalConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AiError('INVALID_CONFIG');
  const c = value as Partial<RagRetrievalConfig>;
  if (
    c.maxChunks !== 3 ||
    typeof c.maxCosineDistance !== 'number' ||
    !Number.isFinite(c.maxCosineDistance) ||
    c.maxCosineDistance < 0 ||
    c.maxCosineDistance > 2 ||
    !isHash(c.embeddingConfigHash) ||
    !isHash(c.evaluationSetHash)
  )
    throw new AiError('INVALID_CONFIG');
  return Object.freeze({
    maxChunks: 3,
    maxCosineDistance: c.maxCosineDistance,
    embeddingConfigHash: c.embeddingConfigHash,
    evaluationSetHash: c.evaluationSetHash,
  });
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AiError('TIMEOUT');
}

function validActor(ctx: ActorContext): boolean {
  return Boolean(
    ctx &&
    typeof ctx.uid === 'string' &&
    ctx.uid &&
    typeof ctx.businessId === 'string' &&
    ctx.businessId &&
    (ctx.role === 'HQ' || ctx.role === 'SALON') &&
    Array.isArray(ctx.salonIds) &&
    (ctx.role === 'HQ' || ctx.salonIds.length > 0),
  );
}

/** Raw candidates are for offline calibration; the SQL eligibility gate still applies. */
export function createProcedureCandidateRetriever(dependencies: {
  embedding: RetrievalEmbedding;
  repository: RetrievalRepository;
  embeddingConfigHash: string;
}) {
  const { embedding, repository } = dependencies;
  if (!isHash(dependencies.embeddingConfigHash)) throw new AiError('INVALID_CONFIG');
  if (
    embedding.config.configHash !== dependencies.embeddingConfigHash ||
    embedding.config.dimension !== 768
  )
    throw new AiError('EMBEDDING_CONFIG_MISMATCH');

  return async function retrieveCandidates(
    input: { question: string; limit: 3 },
    ctx: ActorContext,
    signal?: AbortSignal,
  ): Promise<RetrievedChunk[]> {
    if (!validActor(ctx)) throw new AiError('FORBIDDEN');
    if (
      !input ||
      typeof input.question !== 'string' ||
      !input.question.trim() ||
      [...input.question].length > 2000 ||
      input.limit !== 3
    )
      throw new AiError('VALIDATION_ERROR');
    assertNotAborted(signal);
    let vector: number[];
    try {
      vector = validateEmbeddingVectors(
        await embedding.embedTexts([input.question], 'query'),
        1,
        768,
      )[0];
    } catch {
      throw new AiError('PROVIDER_UNAVAILABLE');
    }
    assertNotAborted(signal);
    let chunks: RetrievedChunk[];
    try {
      chunks = await repository.search({
        uid: ctx.uid,
        businessId: ctx.businessId,
        vector,
        embeddingConfigHash: dependencies.embeddingConfigHash,
        embeddingModel: embedding.config.modelId,
        limit: 3,
        kinds: knowledgeKinds,
      });
    } catch (error) {
      if (error instanceof AiError && error.code === 'FORBIDDEN') throw error;
      throw new AiError('SERVICE_UNAVAILABLE');
    }
    assertNotAborted(signal);
    if (
      !Array.isArray(chunks) ||
      chunks.length > 3 ||
      chunks.some(
        (c) =>
          !knowledgeKinds.includes(c.kind) ||
          c.businessId !== ctx.businessId ||
          c.sourceSectionId !== c.chunkId ||
          !Number.isFinite(c.cosineDistance) ||
          c.cosineDistance < 0 ||
          c.cosineDistance > 2,
      )
    )
      throw new AiError('SERVICE_UNAVAILABLE');
    if (chunks.some((c) => c.embeddingConfigHash !== dependencies.embeddingConfigHash))
      throw new AiError('EMBEDDING_CONFIG_MISMATCH');
    return chunks;
  };
}

export function createProcedureRetriever(dependencies: {
  embedding: RetrievalEmbedding;
  repository: RetrievalRepository;
  config: RagRetrievalConfig;
}) {
  const config = parseRagRetrievalConfig(dependencies.config);
  const retrieveCandidates = createProcedureCandidateRetriever({
    ...dependencies,
    embeddingConfigHash: config.embeddingConfigHash,
  });

  async function retrieveProcedure(
    input: { question: string; limit: 3 },
    ctx: ActorContext,
    signal?: AbortSignal,
  ): Promise<RetrievedChunk[]> {
    return (await retrieveCandidates(input, ctx, signal)).filter(
      (c) => c.cosineDistance <= config.maxCosineDistance,
    );
  }
  return Object.assign(retrieveProcedure, { retrieveCandidates });
}

/** Runtime remains fail closed until a measured config file is installed. */
export async function retrieveProcedure(
  input: { question: string; limit: 3 },
  ctx: ActorContext,
  signal?: AbortSignal,
): Promise<RetrievedChunk[]> {
  let config: RagRetrievalConfig;
  try {
    config = parseRagRetrievalConfig(
      JSON.parse(await readFile(join(process.cwd(), 'config/rag-retrieval.json'), 'utf8')),
    );
  } catch {
    throw new AiError('INVALID_CONFIG');
  }
  const runtime = knowledgeRuntimeConfig();
  const embeddingConfig = createEmbeddingConfig({
    projectId: runtime.vertexProject,
    modelId: runtime.vertexModel,
    location: runtime.vertexLocation,
    dimension: runtime.vertexDimension,
    documentMode: 'RETRIEVAL_DOCUMENT',
    queryMode: 'RETRIEVAL_QUERY',
  });
  const embedding = createVertexEmbeddingAdapter(embeddingConfig);
  const repository = createSqlProcedureRepository(knowledgeDataConnectors(runtime).server);
  return createProcedureRetriever({ embedding, repository, config })(input, ctx, signal);
}
