export const KNOWLEDGE_CLOUD_CONFIG_PATH = 'config/knowledge-cloud.json';

export type KnowledgeTestTarget = {
  mode: 'emulator' | 'cloud-sql';
  projectId: string;
  serviceId: string;
  /** Data Connect service location. */
  location: string;
  /** Vertex embedding location, kept independent from the SQL emulator location. */
  embeddingLocation: string;
  model: 'gemini-embedding-001';
  dimension: 768;
};

export type KnowledgeConnector = 'server' | 'vector';

type ResolverInput = {
  env: Record<string, string | undefined>;
  configPath: string | null;
  config: unknown;
};

const cloudTarget: KnowledgeTestTarget = {
  mode: 'cloud-sql',
  projectId: 'notbad-6be95',
  serviceId: 'notbad-6be95-service',
  location: 'europe-west3',
  embeddingLocation: 'europe-west3',
  model: 'gemini-embedding-001',
  dimension: 768,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveKnowledgeTarget(input: ResolverInput): KnowledgeTestTarget {
  const { env } = input;
  if (env.BARBERHQ_TEST_MODE === 'emulator') {
    if (
      env.DATA_CONNECT_EMULATOR_HOST !== '127.0.0.1:9399' &&
      !(
        env.DATA_CONNECT_EMULATOR_HOST === env.BARBERHQ_ISOLATED_DC_HOST &&
        /^127\.0\.0\.1:([1-9][0-9]{3,4})$/.test(env.DATA_CONNECT_EMULATOR_HOST ?? '') &&
        Number(env.DATA_CONNECT_EMULATOR_HOST?.split(':')[1]) <= 65535
      )
    )
      throw new Error('Emulator mode requires the explicit local Data Connect endpoint');
    return {
      mode: 'emulator',
      projectId: 'demo-barberhq',
      serviceId: 'barberhq',
      location: 'europe-west1',
      embeddingLocation: 'europe-west3',
      model: 'gemini-embedding-001',
      dimension: 768,
    };
  }

  if (env.BARBERHQ_TEST_MODE !== 'cloud-sql')
    throw new Error('Set an explicit knowledge test mode');
  if (env.BARBERHQ_ALLOW_TEST_FIXTURES !== cloudTarget.projectId)
    throw new Error('Cloud SQL mode requires explicit fixture approval for the allowed project');
  if (env.BARBERHQ_TEST_CONFIG !== undefined)
    throw new Error('Cloud SQL mode uses only the fixed knowledge target config');
  if (Object.keys(env).some((key) => /EMULATOR/i.test(key)))
    throw new Error('Cloud SQL mode refuses any emulator environment');
  if (input.configPath !== KNOWLEDGE_CLOUD_CONFIG_PATH)
    throw new Error('Cloud SQL mode requires the fixed knowledge target config');

  const config = input.config;
  const dataConnect = isRecord(config) && isRecord(config.dataConnect) ? config.dataConnect : null;
  const vertexAi = isRecord(config) && isRecord(config.vertexAi) ? config.vertexAi : null;
  if (
    !isRecord(config) ||
    config.projectId !== cloudTarget.projectId ||
    config.firebaseStorageBucket !== 'notbad-6be95.firebasestorage.app' ||
    !dataConnect ||
    dataConnect.serviceId !== cloudTarget.serviceId ||
    dataConnect.location !== cloudTarget.location ||
    dataConnect.database !== 'notbad-6be95-database' ||
    dataConnect.instanceId !== 'notbad-6be95-instance' ||
    !vertexAi ||
    vertexAi.model !== cloudTarget.model ||
    vertexAi.location !== cloudTarget.location ||
    vertexAi.dimension !== cloudTarget.dimension
  )
    throw new Error('Cloud SQL mode target is outside the fixed allowlist');

  return { ...cloudTarget };
}

export function knowledgeConnectorConfig(
  target: KnowledgeTestTarget,
  connector: KnowledgeConnector,
) {
  return { connector, serviceId: target.serviceId, location: target.location };
}

/** Owner loopback ports, or an explicit controller-owned isolated pair on loopback. */
export function localEmulatorHosts(env: Record<string, string | undefined> = process.env) {
  const loopback = (host: string | undefined) =>
    /^127\.0\.0\.1:([1-9][0-9]{3,4})$/.test(host ?? '') && Number(host!.split(':')[1]) <= 65535;
  const dc = env.BARBERHQ_ISOLATED_DC_HOST;
  const auth = env.BARBERHQ_ISOLATED_AUTH_HOST;
  if (dc === undefined && auth === undefined)
    return { dc: '127.0.0.1:9399', auth: '127.0.0.1:9099' };
  if (!loopback(dc) || !loopback(auth))
    throw new Error('Isolated mode requires explicit loopback SQL Connect and Auth hosts');
  return { dc: dc!, auth: auth! };
}
