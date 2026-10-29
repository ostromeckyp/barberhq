import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import type { DataConnect } from 'firebase-admin/data-connect';
import { getStorage } from 'firebase-admin/storage';
import { getDataConnect } from 'firebase-admin/data-connect';
import { onRequest } from 'firebase-functions/v2/https';
import { CLOUD } from '../cloud-config.js';
import type { PdfIdentity } from './models/pdf-identity.js';
import type { SourceRequest } from './models/source-request.js';
import type { SourceResponse } from './models/source-response.js';
import type { SourceDeps } from './models/source-deps.js';
import type { SourceStorageEnvironment } from './models/source-storage-environment.js';

const MAX_BYTES = 10 * 1024 * 1024;
const DEMO_PROJECT = 'demo-barberhq';
const DEMO_BUCKET = 'demo-barberhq.appspot.com';
const CLOUD_PROJECT = CLOUD.projectId;
const CLOUD_SERVICE = CLOUD.sqlService;
const CLOUD_LOCATION = CLOUD.sqlLocation;
const CLOUD_BUCKET = CLOUD.bucket;

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

function localHost(value: string, withProtocol: boolean): string {
  if (!withProtocol && value.includes('://')) throw Error('invalid storage emulator host');
  const url = new URL(withProtocol ? value : `http://${value}`);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !url.port ||
    !Number.isInteger(Number(url.port)) ||
    Number(url.port) < 1 ||
    Number(url.port) > 65535 ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw Error('invalid storage emulator host');
  return url.host;
}

export function sourceStorageBucket(config: SourceStorageEnvironment): string {
  const firebaseHost = config.firebaseStorageHost?.trim();
  const storageHost = config.storageHost?.trim();
  if (!config.emulator) {
    if (firebaseHost || storageHost) throw Error('storage emulator configured in production');
    if (!config.cloudBucket) throw Error('missing production storage bucket');
    return config.cloudBucket;
  }
  if (config.projectId !== DEMO_PROJECT) throw Error('invalid emulator project');
  if (!firebaseHost && !storageHost) throw Error('storage emulator not configured');
  const firebaseAddress = firebaseHost ? localHost(firebaseHost, false) : null;
  const storageAddress = storageHost ? localHost(storageHost, true) : null;
  if (firebaseAddress && storageAddress && firebaseAddress !== storageAddress)
    throw Error('storage emulator hosts disagree');
  return DEMO_BUCKET;
}

function sourceRuntimeConfig(emulator: boolean) {
  const projectId = process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const sqlHost = process.env.DATA_CONNECT_EMULATOR_HOST;
  const firebaseStorageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  const storageHost = process.env.STORAGE_EMULATOR_HOST;
  if (emulator) {
    const loopback = (value: string | undefined, protocol: boolean) => {
      if (!value || (!protocol && value.includes('://'))) return false;
      try {
        const url = new URL(
          protocol ? (value.includes('://') ? value : `http://${value}`) : `http://${value}`,
        );
        const port = Number(url.port);
        return (
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
          Number.isInteger(port) &&
          port >= 1 &&
          port <= 65535 &&
          !url.username &&
          !url.password &&
          url.pathname === '/' &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    };
    if (
      projectId !== 'demo-barberhq' ||
      !loopback(authHost, false) ||
      !loopback(sqlHost, false) ||
      (firebaseStorageHost && !loopback(firebaseStorageHost, false)) ||
      (storageHost && !loopback(storageHost, true)) ||
      (!firebaseStorageHost && !storageHost)
    )
      throw Error('invalid local source runtime');
    if (firebaseStorageHost && storageHost) {
      const firebaseAddress = new URL(`http://${firebaseStorageHost}`).host;
      const storageAddress = new URL(
        storageHost.includes('://') ? storageHost : `http://${storageHost}`,
      ).host;
      if (firebaseAddress !== storageAddress) throw Error('storage emulator hosts disagree');
    }
    return {
      serviceId: 'barberhq',
      location: 'europe-west1',
      bucket: DEMO_BUCKET,
      projectId,
      authHost,
      sqlHost,
      firebaseStorageHost,
      storageHost,
    };
  }
  if (projectId !== CLOUD_PROJECT || authHost || sqlHost || firebaseStorageHost || storageHost)
    throw Error('invalid production source runtime');
  return {
    serviceId: CLOUD_SERVICE,
    location: CLOUD_LOCATION,
    bucket: CLOUD_BUCKET,
    projectId,
    authHost,
    sqlHost,
    firebaseStorageHost,
    storageHost,
  };
}

export async function readSourceOriginal(
  identity: PdfIdentity,
  config: SourceStorageEnvironment,
  storageFactory: () => ReturnType<typeof getStorage> = getStorage,
): Promise<Uint8Array> {
  const expectedBucket = sourceStorageBucket(config);
  if (identity.bucket !== expectedBucket || !identity.objectPath) throw Error('storage identity');
  const generation = Number(identity.objectGeneration);
  if (!Number.isSafeInteger(generation) || generation < 1) throw Error('invalid generation');
  const stream = storageFactory()
    .bucket(identity.bucket)
    .file(identity.objectPath, { generation })
    .createReadStream({ start: 0, end: MAX_BYTES });
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of stream) {
    const part = Buffer.from(chunk);
    length += part.length;
    if (length > MAX_BYTES) throw Error('oversize');
    chunks.push(part);
  }
  return Buffer.concat(chunks, length);
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
