import type { DataConnect } from 'firebase-admin/data-connect';
import type { PdfRect } from '../../../shared/contracts/knowledge/index.js';
import { validateEmbeddingVectors } from '../knowledge/embedding.js';
import {
  knowledgeKinds,
  metadataFromStorage,
  storageKind,
  isSyntheticSource,
} from '../../../shared/knowledge-metadata.js';
import { AiError } from './budget.js';
import type { RetrievedChunk } from './models/retrieved-chunk.js';
import type { RetrievalRepository } from './models/retrieval-repository.js';

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
