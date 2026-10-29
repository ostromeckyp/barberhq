import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DataConnect } from 'firebase-admin/data-connect';
import type {
  SourceSection,
  PdfRect,
  KnowledgeDocumentKind,
} from '../../../shared/contracts/knowledge.js';
import {
  createEmbeddingConfig,
  createVertexEmbeddingAdapter,
  validateEmbeddingVectors,
  type EmbeddingConfig,
} from '../knowledge/embedding.js';
import { knowledgeDataConnectors, knowledgeRuntimeConfig } from '../knowledge/runtime.js';
import {
  knowledgeKinds,
  metadataFromStorage,
  storageKind,
  isSyntheticSource,
} from '../../../shared/knowledge-metadata.js';
import { AiError } from './budget.js';
import type { ActorContext } from './context.js';

export type RetrievedChunk = SourceSection & {
  cosineDistance: number;
  documentRevision: number;
  embeddingConfigHash: string;
};

export type RagRetrievalConfig = {
  maxChunks: 3;
  maxCosineDistance: number;
  embeddingConfigHash: string;
  evaluationSetHash: string;
};

export type RetrievalEmbedding = {
  config: EmbeddingConfig;
  embedTexts(texts: string[], mode: 'query'): Promise<number[][]>;
};

export type RetrievalRepository = {
  /** Authorization and every corpus filter run inside SQL before ORDER BY/LIMIT. */
  search(input: {
    uid: string;
    businessId: string;
    vector: number[];
    embeddingConfigHash: string;
    embeddingModel: string;
    limit: 3;
    kinds: readonly KnowledgeDocumentKind[];
  }): Promise<RetrievedChunk[]>;
};

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

type RawRow = Record<string, unknown>;
function record(value: unknown): RawRow {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new AiError('SERVICE_UNAVAILABLE');
  return value as RawRow;
}
function string(row: RawRow, key: string): string {
  const value = row[key];
  if (typeof value !== 'string' || !value) throw new AiError('SERVICE_UNAVAILABLE');
  return value;
}
function integer(row: RawRow, key: string, minimum = 0): number {
  const value = row[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    throw new AiError('SERVICE_UNAVAILABLE');
  return value as number;
}
function finite(row: RawRow, key: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new AiError('SERVICE_UNAVAILABLE');
  return value;
}
function json(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    throw new AiError('SERVICE_UNAVAILABLE');
  }
}
function rects(value: unknown): PdfRect[] {
  const raw = json(value);
  if (
    !Array.isArray(raw) ||
    !raw.every(
      (r) =>
        r &&
        typeof r === 'object' &&
        ['xMin', 'yMin', 'xMax', 'yMax'].every(
          (key) => typeof r[key] === 'number' && Number.isFinite(r[key]),
        ),
    )
  )
    throw new AiError('SERVICE_UNAVAILABLE');
  return raw as PdfRect[];
}
function mapRow(value: unknown, businessId: string): RetrievedChunk {
  const row = record(value);
  const viewBox = json(row.view_box);
  if (
    !Array.isArray(viewBox) ||
    viewBox.length !== 4 ||
    !viewBox.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    throw new AiError('SERVICE_UNAVAILABLE');
  const metadata = metadataFromStorage(row);
  const geometryStatus = string(row, 'geometry_status');
  if (!['VERIFIED', 'UNAVAILABLE'].includes(geometryStatus) || typeof row.synthetic !== 'boolean')
    throw new AiError('SERVICE_UNAVAILABLE');
  const chunkId = string(row, 'chunk_id');
  return {
    businessId,
    documentId: string(row, 'document_id'),
    versionId: string(row, 'version_id'),
    version: string(row, 'version_label'),
    title: string(row, 'title'),
    language: string(row, 'language'),
    ...metadata,
    synthetic: isSyntheticSource(metadata),
    superseded: false,
    pageCount: integer(row, 'page_count', 1),
    chunkId,
    sourceSectionId: chunkId,
    sectionId: string(row, 'section_id'),
    physicalPage: integer(row, 'physical_page', 1),
    excerpt: string(row, 'excerpt'),
    geometry: {
      viewBox: viewBox as [number, number, number, number],
      userUnit: finite(row, 'user_unit'),
      rotation: integer(row, 'rotation'),
    },
    rects: rects(row.rects),
    geometryStatus: geometryStatus as 'VERIFIED' | 'UNAVAILABLE',
    cosineDistance: finite(row, 'cosine_distance'),
    documentRevision: integer(row, 'document_revision'),
    embeddingConfigHash: string(row, 'embedding_config_hash'),
  };
}

/** Named operation is defined only in the server connector; no browser SQL access. */
export function createSqlProcedureRepository(dc: DataConnect): RetrievalRepository {
  return {
    async search(input) {
      if (
        !Array.isArray(input.kinds) ||
        !input.kinds.length ||
        input.kinds.some((k) => !knowledgeKinds.includes(k))
      )
        throw new AiError('VALIDATION_ERROR');
      validateEmbeddingVectors([input.vector], 1, 768);
      let data: { result: unknown };
      try {
        data = (
          await dc.executeQuery<
            { result: unknown },
            {
              uid: string;
              businessId: string;
              vectorText: string;
              configHash: string;
              model: string;
              kindsJson: string;
            }
          >('SearchEligibleProcedureChunks', {
            uid: input.uid,
            businessId: input.businessId,
            vectorText: `[${input.vector.join(',')}]`,
            configHash: input.embeddingConfigHash,
            model: input.embeddingModel,
            kindsJson: JSON.stringify(input.kinds.map(storageKind)),
          })
        ).data;
      } catch (error) {
        if (error instanceof Error && error.message.includes('FORBIDDEN'))
          throw new AiError('FORBIDDEN');
        throw new AiError('SERVICE_UNAVAILABLE');
      }
      const result = record(data.result);
      if (result.authorized === false) throw new AiError('FORBIDDEN');
      if (result.authorized !== true) throw new AiError('SERVICE_UNAVAILABLE');
      const chunks = json(result.chunks);
      if (!Array.isArray(chunks)) throw new AiError('SERVICE_UNAVAILABLE');
      return chunks.map((row) => mapRow(row, input.businessId));
    },
  };
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
