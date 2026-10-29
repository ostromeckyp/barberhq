import { getAppCheck } from 'firebase-admin/app-check';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { createEmbeddingConfig, createVertexEmbeddingAdapter } from './embedding.js';
import { DocumentCommandService } from './document-commands.js';
import { KnowledgePipeline } from './pipeline.js';
import { KnowledgeRepository, KnowledgeError } from './repository.js';
import { ReviewPublishService } from './review-publish.js';
import {
  createUserEndpoint,
  knowledgeBucket,
  knowledgeDataConnectors,
  knowledgeRuntimeConfig,
} from './runtime.js';
import { DispatchService } from './queue.js';
import * as sql from '@barberhq/server';
import { parseReviewDocument } from './schemas.js';

const REGION = 'europe-west1';
const bearer = (request: CallableRequest<unknown>): string | undefined => {
  const value = request.rawRequest.headers.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : undefined;
};
const appCheckToken = (request: CallableRequest<unknown>): string | undefined => {
  const value = request.rawRequest.headers['x-firebase-appcheck'];
  return typeof value === 'string' ? value : undefined;
};

export function publicError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof KnowledgeError) {
    const code =
      error.code === 'UNAUTHENTICATED'
        ? 'unauthenticated'
        : error.code === 'FORBIDDEN'
          ? 'permission-denied'
          : error.code === 'VALIDATION_ERROR'
            ? 'invalid-argument'
            : error.code === 'APP_CHECK_REQUIRED'
              ? 'failed-precondition'
              : error.code === 'NOT_FOUND'
                ? 'not-found'
                : error.code === 'QUEUE_UNAVAILABLE'
                  ? 'unavailable'
                  : error.code === 'OUTCOME_UNKNOWN'
                    ? 'unavailable'
                    : 'failed-precondition';
    throw new HttpsError(code, error.code, { code: error.code });
  }
  throw new HttpsError('unavailable', 'OUTCOME_UNKNOWN', { code: 'OUTCOME_UNKNOWN' });
}

export function callable<T, R>(operation: (uid: string, data: T) => Promise<R>) {
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const secured = createUserEndpoint(operation, {
    verifyAuth: async (token) => {
      try {
        return (await getAuth().verifyIdToken(token, true)).uid;
      } catch {
        return null;
      }
    },
    verifyAppCheck: async (token) => {
      try {
        await getAppCheck().verifyToken(token);
        return true;
      } catch {
        return false;
      }
    },
  });
  return onCall({ region: REGION, enforceAppCheck: !emulator }, async (request) => {
    try {
      return await secured({
        data: request.data as T,
        authUid: request.auth?.uid,
        idToken: bearer(request),
        appCheckToken: appCheckToken(request),
        emulator,
      });
    } catch (error) {
      return publicError(error);
    }
  });
}

function createDocumentService() {
  const config = knowledgeRuntimeConfig();
  const connectors = knowledgeDataConnectors(config);
  const repo = new KnowledgeRepository(
    connectors.server,
    connectors.vector,
    knowledgeBucket(config),
  );
  return new DocumentCommandService(repo);
}

function createDispatchService() {
  const config = knowledgeRuntimeConfig();
  const connectors = knowledgeDataConnectors(config);
  return new DispatchService(
    new KnowledgeRepository(connectors.server, connectors.vector, knowledgeBucket(config)),
  );
}

type ReviewVersionLookup = {
  readMembership(
    uid: string,
  ): Promise<Pick<NonNullable<sql.ReadMembershipData['membership']>, 'role' | 'businessId'> | null>;
  version(versionId: string): Promise<{ businessId: string } | null>;
};

/** Check fresh HQ membership before revealing whether a version ID exists. */
export async function authorizeReviewVersion(
  uid: string,
  versionId: string,
  lookup: ReviewVersionLookup,
) {
  if (!uid) throw new KnowledgeError('UNAUTHENTICATED');
  const member = await lookup.readMembership(uid);
  if (member?.role !== 'HQ') throw new KnowledgeError('FORBIDDEN');
  const version = await lookup.version(versionId);
  if (!version || version.businessId !== member.businessId) throw new KnowledgeError('FORBIDDEN');
  return version;
}

export async function createReviewService(uid: string, versionId: string) {
  const config = knowledgeRuntimeConfig();
  const connectors = knowledgeDataConnectors(config);
  const repo = new KnowledgeRepository(
    connectors.server,
    connectors.vector,
    knowledgeBucket(config),
  );
  const version = await authorizeReviewVersion(uid, versionId, {
    readMembership: async (actorUid) =>
      (await sql.readMembership(connectors.server, { uid: actorUid })).data.membership ?? null,
    version: (versionId) => repo.version(versionId),
  });
  const embedder = createVertexEmbeddingAdapter(
    createEmbeddingConfig({
      projectId: config.vertexProject,
      modelId: config.vertexModel,
      dimension: config.vertexDimension,
      documentMode: 'RETRIEVAL_DOCUMENT',
      queryMode: 'RETRIEVAL_QUERY',
      location: config.vertexLocation,
    }),
  );
  const pipeline = new KnowledgePipeline(repo, embedder, version.businessId, version.businessId);
  return new ReviewPublishService({ repo, pipeline });
}

export function createDocumentUploadFunction() {
  return callable<unknown, unknown>(async (uid, data) => createDocumentService().create(uid, data));
}
export function reviewAndPublishDocumentFunction() {
  return callable<{ versionId: string }, unknown>(async (uid, data) => {
    const input = parseReviewDocument(data);
    return (await createReviewService(uid, input.versionId)).reviewAndPublishDocument(uid, input);
  });
}
export function retryDocumentProcessingFunction() {
  return callable<unknown, unknown>(async (uid, data) => createDispatchService().retry(uid, data));
}
export function deleteKnowledgeVersionFunction() {
  return callable<unknown, unknown>(async (uid, data) => createDocumentService().delete(uid, data));
}
