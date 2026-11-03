import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import { getStorage } from 'firebase-admin/storage';
import * as sql from '@barberhq/server';
import { onRequest } from 'firebase-functions/v2/https';
import { status } from './document-commands.js';
import { MAX_PDF_BYTES, PdfValidationError, validatePdf } from './pdf-validation.js';
import { DispatchService } from './queue.js';
import { KnowledgeError, KnowledgeRepository } from './repository.js';
import type { VersionState } from './models/version-state.js';
import { sourceStorageBucket } from './source-storage.js';
import { knowledgeDataConnectors, knowledgeRuntimeConfig } from './runtime.js';
import { CLOUD } from '../cloud-config.js';
import { logStep } from '../logging/log-step.js';
import type { UploadRequest } from './models/upload-request.js';
import type { UploadResponse } from './models/upload-response.js';
import type { UploadDeps } from './models/upload-deps.js';

const header = (r: UploadRequest, name: string) => {
  const v = r.headers[name];
  return typeof v === 'string' ? v : undefined;
};
const deny = (r: UploadResponse, code: number, error: string) => r.status(code).send({ error });
const complete = (v: VersionState) =>
  Boolean(
    v.bucket &&
    v.objectPath &&
    v.objectGeneration &&
    /^[1-9][0-9]*$/.test(v.objectGeneration) &&
    Number.isSafeInteger(Number(v.objectGeneration)) &&
    Number(v.objectGeneration) > 0 &&
    v.contentType === 'application/pdf' &&
    Number.isSafeInteger(v.byteSize) &&
    Number.isSafeInteger(v.pageCount),
  );

async function bodyBytes(request: UploadRequest): Promise<Buffer> {
  // Functions Framework has already populated rawBody. Limit actual bytes before PDF parsing/storage.
  if (request.rawBody !== undefined) {
    const bytes = Buffer.from(request.rawBody);
    if (bytes.length > MAX_PDF_BYTES) throw new KnowledgeError('TOO_LARGE');
    return bytes;
  }
  if (!request[Symbol.asyncIterator]) throw new KnowledgeError('INVALID_PDF');
  const parts: Buffer[] = [];
  let length = 0;
  for await (const value of request as AsyncIterable<Uint8Array>) {
    const part = Buffer.from(value);
    length += part.length;
    if (length > MAX_PDF_BYTES) throw new KnowledgeError('TOO_LARGE');
    parts.push(part);
  }
  return Buffer.concat(parts, length);
}

export function createUploadHandler(deps: UploadDeps) {
  const allowed = new Set(deps.origins.filter(Boolean));
  return async (request: UploadRequest, response: UploadResponse): Promise<void> => {
    response.set('Cache-Control', 'private, no-store').set('Vary', 'Origin');
    const origin = header(request, 'origin');
    if (origin && !allowed.has(origin)) {
      deny(response, 403, 'FORBIDDEN');
      return;
    }
    if (origin) response.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      if (!origin) {
        deny(response, 403, 'FORBIDDEN');
        return;
      }
      response
        .set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        .set('Access-Control-Allow-Headers', 'Authorization, X-Firebase-AppCheck, Content-Type')
        .status(204)
        .end();
      return;
    }
    if (request.method !== 'POST') {
      deny(response, 405, 'METHOD_NOT_ALLOWED');
      return;
    }
    const keys = Object.keys(request.query),
      versionId = request.query.versionId;
    if (
      keys.length !== 1 ||
      keys[0] !== 'versionId' ||
      typeof versionId !== 'string' ||
      !versionId ||
      versionId.length > 200
    ) {
      deny(response, 400, 'INVALID_ARGUMENT');
      return;
    }
    if (
      header(request, 'content-type') !== 'application/pdf' ||
      (header(request, 'content-encoding') && header(request, 'content-encoding') !== 'identity')
    ) {
      deny(response, 415, 'INVALID_CONTENT_TYPE');
      return;
    }
    const bearer = header(request, 'authorization');
    if (!bearer?.startsWith('Bearer ') || bearer.length <= 7) {
      deny(response, 401, 'UNAUTHENTICATED');
      return;
    }
    try {
      const uid = await deps.verifyAuth(bearer.slice(7));
      if (!uid) throw new KnowledgeError('UNAUTHENTICATED');
      if (
        !deps.emulator &&
        (!header(request, 'x-firebase-appcheck') ||
          !(await deps.verifyAppCheck(header(request, 'x-firebase-appcheck')!)))
      )
        throw new KnowledgeError('APP_CHECK_REQUIRED');
      const member = (await sql.readMembership(deps.repo.dc, { uid })).data.membership;
      const version = await deps.repo.version(versionId);
      if (member?.role !== 'HQ' || !version || version.businessId !== member.businessId)
        throw new KnowledgeError('FORBIDDEN');
      if (version.revokedAt || version.publishedAt) throw new KnowledgeError('VERSION_CONFLICT');
      const bytes = await bodyBytes(request);
      if (bytes.length < 5 || bytes.subarray(0, 5).toString() !== '%PDF-')
        throw new KnowledgeError('INVALID_PDF');
      const sha = createHash('sha256').update(bytes).digest('hex');
      if (sha !== version.pdfSha256) throw new KnowledgeError('INVALID_PDF');
      let pageCount: number;
      try {
        ({ pageCount } = await validatePdf(bytes));
      } catch (error) {
        if (error instanceof PdfValidationError)
          throw new KnowledgeError(error.code === 'TOO_LARGE' ? 'TOO_LARGE' : 'INVALID_PDF');
        throw error;
      }
      const path = `knowledge/${version.businessId}/${version.document.documentCode}/${version.versionLabel}/${sha}.pdf`;
      if (complete(version)) {
        if (
          version.bucket !== deps.repo.bucket.name ||
          version.objectPath !== path ||
          version.byteSize !== bytes.length ||
          version.pageCount !== pageCount ||
          version.contentType !== 'application/pdf' ||
          !version.objectGeneration
        )
          throw new KnowledgeError('VERSION_CONFLICT');
        if (
          version.processingLeaseId &&
          version.pendingStage === 'EXTRACT' &&
          ['STAGED', 'FAILED'].includes(version.status)
        ) {
          response.status(200).send(status(version));
          return;
        }
        if (!['STAGED', 'FAILED'].includes(version.status) || version.pendingStage !== 'EXTRACT') {
          response.status(200).send(status(version));
          return;
        }
      } else {
        if (
          version.status !== 'STAGED' ||
          version.bucket ||
          version.objectPath ||
          version.objectGeneration ||
          version.byteSize ||
          version.pageCount
        )
          throw new KnowledgeError('VERSION_CONFLICT');
        const object = await deps.repo.putOriginal(path, bytes, sha);
        if (object.bucket !== deps.repo.bucket.name || object.path !== path)
          throw new KnowledgeError('VERSION_CONFLICT');
        try {
          await sql.bindKnowledgeOriginal(deps.repo.dc, {
            uid,
            businessId: version.businessId,
            versionId,
            pdfSha256: sha,
            bucket: object.bucket,
            objectPath: object.path,
            objectGeneration: object.generation,
            byteSize: bytes.length,
            pageCount,
          });
        } catch {
          const fresh = await deps.repo.version(versionId);
          if (
            !fresh ||
            fresh.revokedAt ||
            fresh.publishedAt ||
            fresh.bucket !== object.bucket ||
            fresh.objectPath !== path ||
            fresh.objectGeneration !== object.generation ||
            fresh.byteSize !== bytes.length ||
            fresh.pageCount !== pageCount
          )
            throw new KnowledgeError('OUTCOME_UNKNOWN');
        }
      }
      const result = await deps.dispatch.dispatch(uid, versionId);
      response.status(200).send(result);
    } catch (error) {
      const code = error instanceof KnowledgeError ? error.code : 'OUTCOME_UNKNOWN';
      const http =
        code === 'UNAUTHENTICATED' || code === 'APP_CHECK_REQUIRED'
          ? 401
          : code === 'FORBIDDEN'
            ? 403
            : code === 'TOO_LARGE'
              ? 413
              : code === 'INVALID_PDF'
                ? 400
                : code === 'VERSION_CONFLICT' || code === 'STALE_STATE'
                  ? 409
                  : 503;
      deny(response, http, code === 'OUTCOME_UNKNOWN' ? 'UPLOAD_UNAVAILABLE' : code);
    }
  };
}

/** Exported factory only; Task 2C/controller owns callable exports and deployment packaging. */
export function uploadKnowledgePdfFunction() {
  return onRequest(
    { region: 'europe-west1', maxInstances: 5, memory: '512MiB' },
    async (request, response) => {
      const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
      const origins = [...CLOUD.allowedOrigins];
      if (emulator) origins.push('http://localhost:4200', 'http://127.0.0.1:4200');
      const config = knowledgeRuntimeConfig();
      const connectors = knowledgeDataConnectors(config);
      const bucketName = sourceStorageBucket({
        emulator,
        projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
        cloudBucket: emulator ? '' : config.bucket,
        firebaseStorageHost: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
        storageHost: process.env.STORAGE_EMULATOR_HOST,
      });
      const repo = new KnowledgeRepository(
        connectors.server,
        connectors.vector,
        getStorage().bucket(bucketName),
      );
      const dispatch = new DispatchService(repo);
      await logStep(
        'knowledge.upload',
        async () => {
          await createUploadHandler({
            repo,
            dispatch,
            origins,
            emulator,
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
          })(request as unknown as UploadRequest, response);
          return response.statusCode;
        },
        (status) => ({ status }),
      );
    },
  );
}
