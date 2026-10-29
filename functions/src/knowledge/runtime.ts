import { getDataConnect } from 'firebase-admin/data-connect';
import { getStorage } from 'firebase-admin/storage';
import { CLOUD } from '../cloud-config.js';
import { KnowledgeError } from './repository.js';
import type { KnowledgeRuntimeInput } from './models/knowledge-runtime-input.js';
import type { KnowledgeRuntimeConfig } from './models/knowledge-runtime-config.js';
import type { UserEndpointRequest } from './models/user-endpoint-request.js';
import type { UserEndpointDependencies } from './models/user-endpoint-dependencies.js';

const PROJECT = CLOUD.projectId;
const CLOUD_SERVICE = CLOUD.sqlService;
const CLOUD_LOCATION = CLOUD.sqlLocation;
const CLOUD_BUCKET = CLOUD.bucket;
const VERTEX_MODEL = CLOUD.vertexAi.model;
const VERTEX_LOCATION = CLOUD.vertexAi.location;
const VERTEX_DIMENSION = CLOUD.vertexAi.dimension;
const DEMO_PROJECT = 'demo-barberhq';
const DEMO_BUCKET = 'demo-barberhq.appspot.com';

function isLoopback(host: string | undefined, allowUrl: boolean): boolean {
  if (!host) return false;
  try {
    if (!allowUrl && host.includes('://')) return false;
    const url = new URL(
      allowUrl ? (host.includes('://') ? host : `http://${host}`) : `http://${host}`,
    );
    const port = Number(url.port);
    return (
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      Boolean(url.port) &&
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
}

/** Shared fail-closed validation for callable, upload, and task runtime construction. */
export function createKnowledgeRuntimeConfig(input: KnowledgeRuntimeInput): KnowledgeRuntimeConfig {
  const vertexDimension = Number(input.vertexDimension ?? VERTEX_DIMENSION);
  const vertexProject = input.vertexProject ?? PROJECT;
  const vertexModel = input.vertexModel ?? VERTEX_MODEL;
  const vertexLocation = input.vertexLocation ?? VERTEX_LOCATION;
  if (
    vertexProject !== PROJECT ||
    vertexModel !== VERTEX_MODEL ||
    vertexLocation !== VERTEX_LOCATION ||
    !Number.isSafeInteger(vertexDimension) ||
    vertexDimension !== VERTEX_DIMENSION
  ) {
    throw new KnowledgeError(
      'INVALID_CONFIG',
      'Vertex configuration differs from the approved knowledge runtime',
    );
  }
  if (input.emulator) {
    const firebaseStorageHost = input.firebaseStorageHost?.trim();
    const storageHost = input.storageHost?.trim();
    if (
      input.projectId !== DEMO_PROJECT ||
      !isLoopback(input.authHost, false) ||
      !isLoopback(input.sqlHost, false) ||
      (firebaseStorageHost && !isLoopback(firebaseStorageHost, false)) ||
      (storageHost && !isLoopback(storageHost, true)) ||
      (!firebaseStorageHost && !storageHost) ||
      (firebaseStorageHost &&
        storageHost &&
        new URL(`http://${firebaseStorageHost}`).host !==
          new URL(storageHost!.includes('://') ? storageHost! : `http://${storageHost}`).host) ||
      (input.serviceId && input.serviceId !== 'barberhq') ||
      (input.sqlLocation && input.sqlLocation !== 'europe-west1') ||
      (input.bucket && input.bucket !== DEMO_BUCKET)
    ) {
      throw new KnowledgeError(
        'INVALID_CONFIG',
        'Local knowledge runtime requires demo-barberhq and loopback emulators',
      );
    }
    return {
      emulator: true,
      projectId: DEMO_PROJECT,
      serviceId: 'barberhq',
      sqlLocation: 'europe-west1',
      bucket: DEMO_BUCKET,
      vertexProject,
      vertexModel,
      vertexLocation,
      vertexDimension,
    };
  }
  if (
    input.authHost ||
    input.sqlHost ||
    input.firebaseStorageHost ||
    input.storageHost ||
    input.projectId !== PROJECT ||
    input.serviceId !== CLOUD_SERVICE ||
    input.sqlLocation !== CLOUD_LOCATION ||
    input.bucket !== CLOUD_BUCKET
  ) {
    throw new KnowledgeError(
      'INVALID_CONFIG',
      'Production knowledge runtime config is incomplete or contains emulator settings',
    );
  }
  return {
    emulator: false,
    projectId: PROJECT,
    serviceId: CLOUD_SERVICE,
    sqlLocation: CLOUD_LOCATION,
    bucket: CLOUD_BUCKET,
    vertexProject,
    vertexModel,
    vertexLocation,
    vertexDimension,
  };
}

export function knowledgeRuntimeConfig(): KnowledgeRuntimeConfig {
  const emulator = process.env.FUNCTIONS_EMULATOR === 'true';
  return createKnowledgeRuntimeConfig({
    emulator,
    projectId: process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT,
    authHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    sqlHost: process.env.DATA_CONNECT_EMULATOR_HOST,
    firebaseStorageHost: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    storageHost: process.env.STORAGE_EMULATOR_HOST,
    serviceId: emulator ? 'barberhq' : CLOUD_SERVICE,
    sqlLocation: emulator ? 'europe-west1' : CLOUD_LOCATION,
    bucket: emulator ? DEMO_BUCKET : CLOUD_BUCKET,
    vertexProject: PROJECT,
    vertexModel: VERTEX_MODEL,
    vertexLocation: VERTEX_LOCATION,
    vertexDimension: String(VERTEX_DIMENSION),
  });
}

export function knowledgeDataConnectors(config: KnowledgeRuntimeConfig) {
  return {
    server: getDataConnect({
      serviceId: config.serviceId,
      location: config.sqlLocation,
      connector: 'server',
    }),
    vector: getDataConnect({
      serviceId: config.serviceId,
      location: config.sqlLocation,
      connector: 'vector',
    }),
  };
}

export function knowledgeBucket(config: KnowledgeRuntimeConfig) {
  return getStorage().bucket(config.bucket);
}

/** Testable security boundary shared by all authenticated callable adapters. */
export function createUserEndpoint<T, R>(
  operation: (uid: string, data: T) => Promise<R>,
  deps: UserEndpointDependencies,
) {
  return async (request: UserEndpointRequest<T>): Promise<R> => {
    const uid = request.idToken ? await deps.verifyAuth(request.idToken) : null;
    if (!uid || uid !== request.authUid) throw new KnowledgeError('UNAUTHENTICATED');
    if (
      !request.emulator &&
      (!request.appCheckToken || !(await deps.verifyAppCheck(request.appCheckToken)))
    )
      throw new KnowledgeError('APP_CHECK_REQUIRED');
    if (typeof request.data !== 'object' || request.data === null || Array.isArray(request.data))
      throw new KnowledgeError('VALIDATION_ERROR');
    const untrusted = request.data as Record<string, unknown>;
    if (
      ['actorUid', 'actorId', 'businessId', 'objectPath', 'bucket', 'publicationStatus'].some(
        (key) => Object.hasOwn(untrusted, key),
      )
    )
      throw new KnowledgeError('VALIDATION_ERROR');
    return operation(uid, request.data);
  };
}
