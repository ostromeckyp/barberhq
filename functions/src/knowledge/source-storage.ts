import { getStorage } from 'firebase-admin/storage';
import { CLOUD } from '../cloud-config.js';
import type { PdfIdentity } from './models/pdf-identity.js';
import type { SourceStorageEnvironment } from './models/source-storage-environment.js';

export const MAX_BYTES = 10 * 1024 * 1024;
const DEMO_PROJECT = 'demo-barberhq';
const DEMO_BUCKET = 'demo-barberhq.appspot.com';
const CLOUD_PROJECT = CLOUD.projectId;
const CLOUD_SERVICE = CLOUD.sqlService;
const CLOUD_LOCATION = CLOUD.sqlLocation;
const CLOUD_BUCKET = CLOUD.bucket;

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

export function sourceRuntimeConfig(emulator: boolean) {
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
