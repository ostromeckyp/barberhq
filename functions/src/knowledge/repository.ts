import { createHash } from 'node:crypto';
import type { DataConnect } from 'firebase-admin/data-connect';
import type { getStorage } from 'firebase-admin/storage';
import * as sql from '@barberhq/server';
import { validateEmbeddingVectors } from './embedding.js';
import type { VersionState } from './models/version-state.js';
import type { DocumentState } from './models/document-state.js';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

/** All mutations use the server connector. The Vector scalar currently needs the
 * compiled vector connector because the Admin SDK generator rejects Vector vars. */
export class KnowledgeRepository {
  constructor(
    readonly dc: DataConnect,
    readonly vectorDc: DataConnect,
    readonly bucket: Bucket,
  ) {}

  async version(id: string): Promise<VersionState | null> {
    return (
      (await sql.knowledgeVersionState(this.dc, { versionId: id })).data.knowledgeVersion ?? null
    );
  }
  async document(id: string): Promise<DocumentState | null> {
    return (
      (await sql.knowledgeDocumentState(this.dc, { documentId: id })).data.knowledgeDocument ?? null
    );
  }
  async putOriginal(
    path: string,
    bytes: Uint8Array,
    sha256: string,
  ): Promise<{ bucket: string; path: string; generation: string }> {
    const file = this.bucket.file(path);
    try {
      await file.save(Buffer.from(bytes), {
        contentType: 'application/pdf',
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { cacheControl: 'private, no-store', metadata: { sha256 } },
      });
    } catch (error) {
      // A retry may see the existing immutable object. Only identical bytes qualify.
      if (!isPreconditionFailure(error)) throw error;
      const [existingBytes] = await file.download();
      if (
        existingBytes.length !== bytes.length ||
        createHash('sha256').update(existingBytes).digest('hex') !== sha256
      ) {
        throw new KnowledgeError(
          'VERSION_CONFLICT',
          'Immutable PDF object bytes differ from the requested version',
        );
      }
    }
    const [metadata] = await file.getMetadata();
    if (
      metadata.metadata?.sha256 !== sha256 ||
      Number(metadata.size) !== bytes.length ||
      !metadata.generation
    ) {
      throw new KnowledgeError(
        'VERSION_CONFLICT',
        'Immutable PDF object differs from the requested version',
      );
    }
    return { bucket: this.bucket.name, path, generation: String(metadata.generation) };
  }
  async original(version: VersionState): Promise<Uint8Array> {
    if (
      version.bucket !== this.bucket.name ||
      !version.objectPath ||
      !version.objectGeneration ||
      !/^[1-9][0-9]*$/.test(version.objectGeneration) ||
      version.contentType !== 'application/pdf' ||
      !Number.isSafeInteger(version.byteSize) ||
      version.byteSize! < 5 ||
      version.byteSize! > 10 * 1024 * 1024 ||
      !Number.isSafeInteger(version.pageCount) ||
      version.pageCount! < 1 ||
      version.pageCount! > 30 ||
      !/^[a-f0-9]{64}$/.test(version.pdfSha256)
    )
      throw new KnowledgeError('STORAGE_IDENTITY');
    const [bytes] = await this.bucket
      .file(version.objectPath, { generation: Number(version.objectGeneration) })
      .download();
    return new Uint8Array(bytes);
  }
  async stage(input: sql.StageKnowledgeVersionVariables): Promise<void> {
    await sql.stageKnowledgeVersion(this.dc, input);
  }
  async begin(versionId: string, revision: number, pdfSha256: string): Promise<void> {
    await sql.beginKnowledgeExtraction(this.dc, {
      versionId,
      revision,
      pdfSha256,
      now: new Date().toISOString(),
    });
  }
  async claimExtraction(input: {
    versionId: string;
    revision: number;
    expectedDocumentRevision: number;
    pdfSha256: string;
    leaseId: string;
    now: Date;
    expiresAt: Date;
  }): Promise<{ revision: number; leaseId: string }> {
    await sql.claimKnowledgeExtraction(this.dc, {
      ...input,
      now: input.now.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
    });
    return { revision: input.revision + 1, leaseId: input.leaseId };
  }
  async failExtraction(input: {
    versionId: string;
    revision: number;
    pdfSha256: string;
    leaseId: string;
    errorCode: string;
  }): Promise<void> {
    await sql.failKnowledgeExtraction(this.dc, input);
  }
  async page(input: sql.InsertKnowledgePageVariables): Promise<void> {
    await sql.insertKnowledgePage(this.dc, input);
  }
  async chunk(input: {
    id: string;
    versionId: string;
    revision: number;
    pdfSha256: string;
    leaseId: string | null;
    physicalPage: number;
    ordinal: number;
    sectionId: string;
    heading: string;
    text: string;
    start: number;
    end: number;
    rects: unknown;
    geometryStatus: 'VERIFIED' | 'UNAVAILABLE';
    embedding: number[];
    embeddingModel: string;
    embeddingDimension: number;
    embeddingConfigHash: string;
  }): Promise<void> {
    validateEmbeddingVectors([input.embedding], 1, 768);
    await this.vectorDc.executeGraphql(INSERT_CHUNK, { variables: input });
  }
  async save(input: sql.SaveKnowledgeExtractionVariables): Promise<void> {
    await sql.saveKnowledgeExtraction(this.dc, input);
  }
  async reviewPage(versionId: string, physicalPage: number, extractionHash: string): Promise<void> {
    await sql.markKnowledgePageReviewed(this.dc, { versionId, physicalPage, extractionHash });
  }
  async recordReview(
    versionId: string,
    revision: number,
    extractionHash: string,
    pageCount: number,
    reviewedBy: string,
  ): Promise<void> {
    await sql.recordKnowledgeReview(this.dc, {
      versionId,
      revision,
      extractionHash,
      pageCount,
      reviewedBy,
    });
  }
  async ready(
    versionId: string,
    revision: number,
    configHash: string,
    chunkCount: number,
  ): Promise<void> {
    await sql.markKnowledgeReady(this.dc, { versionId, revision, configHash, chunkCount });
  }
  async setOperatorPublishIntent(
    input: sql.SetOperatorKnowledgePublishIntentVariables,
  ): Promise<void> {
    await sql.setOperatorKnowledgePublishIntent(this.dc, input);
  }
  async businessProductKnowledgeRevision(businessId: string): Promise<number> {
    const { data } = await this.dc.executeGraphql<
      { business: { productKnowledgeRevision: number } | null },
      { id: string }
    >('query($id:String!){business(id:$id){productKnowledgeRevision}}', {
      variables: { id: businessId },
    });
    if (!data.business) throw new KnowledgeError('NOT_FOUND');
    return data.business.productKnowledgeRevision;
  }
  async recordOperatorProductReview(input: {
    businessId: string;
    versionId: string;
    extractionHash: string;
    catalogRevision: number;
    reviewedHash: string;
    stateJson: string;
    linksJson: string;
  }): Promise<void> {
    try {
      await this.dc.executeMutation('RecordOperatorProductReview', input);
    } catch {
      throw new KnowledgeError('STALE_STATE');
    }
  }
  async publish(input: sql.PublishKnowledgeVersionVariables): Promise<void> {
    await sql.publishKnowledgeVersion(this.dc, input);
  }
  async markPublishStale(input: sql.MarkKnowledgePublishStaleVariables): Promise<void> {
    await sql.markKnowledgePublishStale(this.dc, input);
  }
  async search(businessId: string, vector: number[], configHash: string) {
    validateEmbeddingVectors([vector], 1, 768);
    const response = await this.vectorDc.executeGraphql<
      {
        knowledgeChunks_embedding_similarity: {
          id: string;
          versionId: string;
          physicalPage: number;
          sectionId: string;
          text: string;
          _metadata: { distance: number };
        }[];
      },
      { businessId: string; vector: number[]; configHash: string }
    >(SEARCH_CHUNKS, { variables: { businessId, vector, configHash } });
    return response.data.knowledgeChunks_embedding_similarity;
  }
}

export class KnowledgeError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'KnowledgeError';
  }
}

function isPreconditionFailure(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 412
  );
}

const INSERT_CHUNK = `mutation InsertKnowledgeChunk($id:String!,$versionId:String!,$revision:Int!,$pdfSha256:String!,$leaseId:String,$physicalPage:Int!,$ordinal:Int!,$sectionId:String!,$heading:String!,$text:String!,$start:Int!,$end:Int!,$rects:Any!,$geometryStatus:KnowledgeGeometryStatus!,$embedding:Vector!,$embeddingModel:String!,$embeddingDimension:Int!,$embeddingConfigHash:String!) @auth(level:NO_ACCESS) @transaction {
  guard:query @redact {knowledgeVersion(id:$versionId) @check(expr:"this != null && this.revision == vars.revision && this.pdfSha256 == vars.pdfSha256 && this.status == 'STAGED' && this.publishedAt == null && this.revokedAt == null && ((vars.leaseId == null && this.processingLeaseId == null) || (vars.leaseId != null && this.processingLeaseId == vars.leaseId))",message:"STALE_STATE") {revision status publishedAt revokedAt pdfSha256 processingLeaseId}}
  knowledgeChunk_insert(data:{id:$id,versionId:$versionId,physicalPage:$physicalPage,ordinal:$ordinal,sectionId:$sectionId,heading:$heading,text:$text,start:$start,end:$end,rects:$rects,geometryStatus:$geometryStatus,embedding:$embedding,embeddingModel:$embeddingModel,embeddingDimension:$embeddingDimension,embeddingConfigHash:$embeddingConfigHash})
}`;

const SEARCH_CHUNKS = `query SearchKnowledgeChunks($businessId:String!,$vector:Vector!,$configHash:String!) @auth(level:NO_ACCESS) {
  knowledgeChunks_embedding_similarity(compare:$vector,method:COSINE,limit:3,where:{version:{businessId:{eq:$businessId},publicationStatus:{eq:DEMO_CURRENT},status:{eq:READY},isActive:{eq:true},revokedAt:{isNull:true},publishedAt:{isNull:false},embeddingConfigHash:{eq:$configHash}}}) {id versionId physicalPage sectionId text _metadata {distance}}
}`;
