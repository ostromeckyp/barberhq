import { randomUUID } from 'node:crypto';
import * as sql from '@barberhq/server';
import type {
  DeleteVersionInput,
  VersionStatus,
} from '../../../shared/contracts/knowledge/index.js';
import {
  legacySourceType,
  storageKind,
  storageOrigin,
  isSyntheticSource,
} from '../../../shared/knowledge-metadata.js';
import { knowledgeIds } from './pipeline-scope.js';
import { KnowledgeError, type KnowledgeRepository } from './repository.js';
import type { VersionState } from './models/version-state.js';
import {
  knowledgePayloadHash,
  parseCreateDocumentRequest,
  normalizeCreateDocument,
  parseDeleteVersion,
} from './schemas.js';

type Context = sql.KnowledgeCommandContextData;
const MAX_SQL_INT = 2_147_483_647;

export function status(version: VersionState): VersionStatus {
  return {
    versionId: version.id,
    documentId: version.documentId,
    documentRevision: version.document.revision,
    versionRevision: version.revision,
    status: version.status,
    retryable:
      (version.pendingStage === 'PUBLISH' && Boolean(version.processingError)) ||
      (version.pendingStage === 'EXTRACT' && Boolean(version.processingError)),
    ...(version.processingError ? { errorCode: version.processingError } : {}),
    revokedAt: version.revokedAt ?? null,
  };
}

/** Authenticated UID is supplied by the callable wrapper. Every mutation rechecks HQ in SQL. */
export class DocumentCommandService {
  constructor(private readonly repo: Pick<KnowledgeRepository, 'dc' | 'version'>) {}

  private async context(
    uid: string,
    key: string,
    documentId = '',
    versionId = '',
  ): Promise<Context> {
    if (!uid) throw new KnowledgeError('UNAUTHENTICATED');
    const member = (await sql.readMembership(this.repo.dc, { uid })).data.membership;
    if (member?.role !== 'HQ') throw new KnowledgeError('FORBIDDEN');
    const { data } = await sql.knowledgeCommandContext(this.repo.dc, {
      uid,
      key,
      documentId,
      versionId,
    });
    if (data.membership?.role !== 'HQ' || data.membership.businessId !== member.businessId)
      throw new KnowledgeError('FORBIDDEN');
    return data;
  }

  private async replay(
    context: Context,
    uid: string,
    key: string,
    action: 'CREATE' | 'DELETE',
    hash: string,
  ): Promise<VersionStatus | undefined> {
    const op = context.membership?.business.operations.find(
      (candidate) => candidate.businessId === context.membership!.businessId,
    );
    if (!op) return;
    if (
      op.actorUid !== uid ||
      op.idempotencyKey !== key ||
      op.action !== action ||
      op.payloadHash !== hash
    )
      throw new KnowledgeError('IDEMPOTENCY_CONFLICT');
    const version = await this.repo.version(op.versionId);
    if (!version || version.businessId !== context.membership!.businessId)
      throw new KnowledgeError('VERSION_CONFLICT');
    return status(version);
  }

  async create(uid: string, raw: unknown): Promise<VersionStatus> {
    const request = parseCreateDocumentRequest(raw);
    const hash = knowledgePayloadHash('CREATE', request);
    const input = normalizeCreateDocument(request);
    for (let attempt = 0; attempt < 6; attempt++) {
      const context = await this.context(uid, input.idempotencyKey, input.documentId ?? '');
      const businessId = context.membership!.businessId;
      const replay = await this.replay(context, uid, input.idempotencyKey, 'CREATE', hash);
      if (replay) return replay;
      if (input.origin === 'public-compilation' && (!input.sourceUrls.length || !input.observedOn))
        throw new KnowledgeError('VALIDATION_ERROR', 'Public compilations require provenance');
      if (input.documentId && context.knowledgeDocument?.businessId !== businessId)
        throw new KnowledgeError('FORBIDDEN');
      const document = context.knowledgeDocument;
      if (document && document.revision !== input.expectedDocumentRevision)
        throw new KnowledgeError('STALE_STATE');
      if (document && document.nextVersionNumber == null)
        throw new KnowledgeError('VERSION_CONFLICT', 'Version cursor is uninitialized');
      const number = document?.nextVersionNumber ?? 1;
      if (!Number.isSafeInteger(number) || number < 1 || number >= MAX_SQL_INT)
        throw new KnowledgeError('VERSION_CONFLICT', 'Version cursor is exhausted');
      const label = `v${number}`;
      const code =
        document?.documentCode ?? `DOC-${randomUUID().replaceAll('-', '').toUpperCase()}`;
      const ids = knowledgeIds(businessId, code, label);
      const documentId = document?.id ?? ids.documentId;
      const versionId = `${documentId}:${label}`;
      try {
        await sql.registerKnowledgeVersion(this.repo.dc, {
          uid,
          businessId,
          documentId,
          documentCode: code,
          versionId,
          versionLabel: label,
          nextVersionNumber: number + 1,
          expectedDocumentRevision: input.expectedDocumentRevision ?? 0,
          newDocument: !document,
          existingDocument: !!document,
          operationId: randomUUID(),
          key: input.idempotencyKey,
          payloadHash: hash,
          title: input.title,
          language: input.language,
          kind: storageKind(input.kind) as sql.KnowledgeDocumentKind,
          origin: storageOrigin(input.origin) as sql.KnowledgeOrigin,
          sourceType:
            (legacySourceType(input)
              ?.replaceAll('-', '_')
              .toUpperCase() as sql.KnowledgeSourceType) ?? null,
          synthetic: isSyntheticSource(input),
          sourceUrls: input.sourceUrls,
          observedOn: input.observedOn,
          pdfSha256: input.sha256,
        });
      } catch (error) {
        const fresh = await this.context(uid, input.idempotencyKey, input.documentId ?? '');
        const raced = await this.replay(fresh, uid, input.idempotencyKey, 'CREATE', hash);
        if (raced) return raced;
        if (fresh.knowledgeDocument && fresh.knowledgeDocument.nextVersionNumber == null)
          throw new KnowledgeError('VERSION_CONFLICT', 'Version cursor is uninitialized');
        if (
          document &&
          fresh.knowledgeDocument?.revision === document.revision &&
          fresh.knowledgeDocument.nextVersionNumber != null &&
          fresh.knowledgeDocument.nextVersionNumber > number
        )
          continue;
        if (fresh.knowledgeDocument?.revision !== input.expectedDocumentRevision && document)
          throw new KnowledgeError('STALE_STATE');
        throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
      }
      const version = await this.repo.version(versionId);
      if (!version)
        throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
      return status(version);
    }
    throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
  }

  async delete(uid: string, raw: unknown): Promise<VersionStatus> {
    const input: DeleteVersionInput = parseDeleteVersion(raw);
    const hash = knowledgePayloadHash('DELETE', input);
    const context = await this.context(uid, input.idempotencyKey, '', input.versionId);
    const replay = await this.replay(context, uid, input.idempotencyKey, 'DELETE', hash);
    if (replay) return replay;
    if (context.knowledgeVersion?.businessId !== context.membership!.businessId)
      throw new KnowledgeError('FORBIDDEN');
    const version = context.knowledgeVersion;
    if (!version || version.revokedAt) throw new KnowledgeError('SOURCE_REVOKED');
    if (
      version.revision !== input.expectedVersionRevision ||
      version.document.revision !== input.expectedDocumentRevision
    )
      throw new KnowledgeError('STALE_STATE');
    try {
      await sql.revokeKnowledgeVersion(this.repo.dc, {
        uid,
        businessId: context.membership!.businessId,
        documentId: version.documentId,
        versionId: version.id,
        expectedDocumentRevision: input.expectedDocumentRevision,
        expectedVersionRevision: input.expectedVersionRevision,
        active: version.document.activeVersionId === version.id,
        operationId: randomUUID(),
        key: input.idempotencyKey,
        payloadHash: hash,
      });
    } catch (error) {
      const fresh = await this.context(uid, input.idempotencyKey, '', input.versionId);
      const replayed = await this.replay(fresh, uid, input.idempotencyKey, 'DELETE', hash);
      if (replayed) return replayed;
      if (
        fresh.knowledgeVersion?.revision !== input.expectedVersionRevision ||
        fresh.knowledgeVersion.document.revision !== input.expectedDocumentRevision
      )
        throw new KnowledgeError('STALE_STATE');
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    }
    const withdrawn = await this.repo.version(input.versionId);
    if (!withdrawn)
      throw new KnowledgeError('OUTCOME_UNKNOWN', 'Retry with the same operation key');
    return status(withdrawn);
  }
}
