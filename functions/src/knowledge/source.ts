import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import type { DataConnect } from 'firebase-admin/data-connect';
import { getDataConnect } from 'firebase-admin/data-connect';
import { onRequest } from 'firebase-functions/v2/https';
import { CLOUD } from '../cloud-config.js';
import type { PdfIdentity } from './models/pdf-identity.js';
import type { SourceRequest } from './models/source-request.js';
import type { SourceResponse } from './models/source-response.js';
import type { SourceDeps } from './models/source-deps.js';
import { MAX_BYTES, readSourceOriginal, sourceRuntimeConfig } from './source-storage.js';

const header = (request: SourceRequest, name: string): string | undefined => {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
};
const deny = (response: SourceResponse, status: number, code: string) =>
  response.status(status).send({ error: code });
const completeOriginal = (identity: PdfIdentity): boolean =>
  Boolean(
    identity.bucket &&
    identity.objectPath &&
    identity.objectGeneration &&
    /^[1-9][0-9]*$/.test(identity.objectGeneration),
  ) &&
  identity.contentType === 'application/pdf' &&
  /^[a-f0-9]{64}$/.test(identity.pdfSha256) &&
  Number.isSafeInteger(identity.byteSize) &&
  identity.byteSize! >= 5 &&
  identity.byteSize! <= MAX_BYTES &&
  Number.isSafeInteger(identity.pageCount) &&
  identity.pageCount! >= 1 &&
  identity.pageCount! <= 30;

export function createSourceHandler(deps: SourceDeps) {
  const allowed = new Set(deps.origins.filter(Boolean));
  return async (request: SourceRequest, response: SourceResponse): Promise<void> => {
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
        .set('Access-Control-Allow-Methods', 'GET, OPTIONS')
        .set('Access-Control-Allow-Headers', 'Authorization, X-Firebase-AppCheck')
        .status(204)
        .end();
      return;
    }
    if (request.method !== 'GET') {
      deny(response, 405, 'METHOD_NOT_ALLOWED');
      return;
    }
    const keys = Object.keys(request.query);
    const versionId = request.query.versionId;
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
    const bearer = header(request, 'authorization');
    if (!bearer?.startsWith('Bearer ') || bearer.length <= 7) {
      deny(response, 401, 'UNAUTHENTICATED');
      return;
    }
    try {
      const uid = await deps.verifyAuth(bearer.slice(7));
      if (!uid) {
        deny(response, 401, 'UNAUTHENTICATED');
        return;
      }
      if (!deps.emulator) {
        const appCheck = header(request, 'x-firebase-appcheck');
        if (!appCheck || !(await deps.verifyAppCheck(appCheck))) {
          deny(response, 401, 'APP_CHECK_REQUIRED');
          return;
        }
      }
      const identity = await deps.resolve(uid, versionId);
      if (
        !identity ||
        identity.id !== versionId ||
        identity.revokedAt ||
        identity.contentType !== 'application/pdf' ||
        !((identity.status === 'READY' && identity.publishedAt) || identity.publishedAt === null)
      ) {
        deny(response, 404, 'SOURCE_NOT_FOUND');
        return;
      }
      if (!completeOriginal(identity)) {
        deny(response, 409, 'SOURCE_UNAVAILABLE');
        return;
      }
      const bytes = await deps.readOriginal(identity);
      if (
        bytes.length !== identity.byteSize ||
        bytes.length > MAX_BYTES ||
        createHash('sha256').update(bytes).digest('hex') !== identity.pdfSha256 ||
        Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-'
      ) {
        deny(response, 409, 'SOURCE_UNAVAILABLE');
        return;
      }
      response
        .set('Content-Type', 'application/pdf')
        .set('Content-Disposition', 'inline')
        .set('X-Content-Type-Options', 'nosniff')
        .send(Buffer.from(bytes));
    } catch {
      deny(response, 503, 'SOURCE_UNAVAILABLE');
    }
  };
}

const SOURCE_LOOKUP = `query SourcePdfIdentity($uid:String!,$versionId:String!) @auth(level:NO_ACCESS) {
  membership(key:{uid:$uid}) {role business {
    versions:knowledgeVersions_on_business(where:{id:{eq:$versionId}},limit:1) {
      id businessId status publishedAt revokedAt bucket objectPath objectGeneration pdfSha256 byteSize pageCount contentType
    }
  }}
}`;

export async function resolveSourceIdentity(
  dc: DataConnect,
  uid: string,
  versionId: string,
): Promise<PdfIdentity | null> {
  const result = await dc.executeGraphql<
    { membership: { role: 'HQ' | 'SALON'; business: { versions: PdfIdentity[] } } | null },
    { uid: string; versionId: string }
  >(SOURCE_LOOKUP, { variables: { uid, versionId } });
  const member = result.data.membership;
  const identity = member?.business.versions[0];
  if (
    !identity ||
    member.business.versions.length !== 1 ||
    identity.revokedAt ||
    !completeOriginal(identity)
  )
    return null;
  if (identity.status === 'READY' && identity.publishedAt) return identity;
  if (member.role === 'HQ' && !identity.publishedAt) return identity;
  return null;
}

export function sourcePdfFunction() {
  return onRequest(
    { region: 'europe-west1', maxInstances: 5, memory: '512MiB' },
    async (request, response) => {
      const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
      const origins = [...CLOUD.allowedOrigins];
      if (emulator) origins.push('http://localhost:4200', 'http://127.0.0.1:4200');
      const config = sourceRuntimeConfig(emulator);
      const connector = getDataConnect({
        serviceId: config.serviceId,
        location: config.location,
        connector: 'server',
      });
      const deps: SourceDeps = {
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
        resolve: async (uid, versionId) => {
          return resolveSourceIdentity(connector, uid, versionId);
        },
        readOriginal: async (identity) => {
          return readSourceOriginal(identity, {
            emulator,
            projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
            cloudBucket: emulator ? '' : config.bucket,
            firebaseStorageHost: config.firebaseStorageHost,
            storageHost: config.storageHost,
          });
        },
      };
      await createSourceHandler(deps)(request as unknown as SourceRequest, response);
    },
  );
}
