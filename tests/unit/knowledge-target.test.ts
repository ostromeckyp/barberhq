import { expect, it } from 'vitest';
import { knowledgeConnectorConfig, resolveKnowledgeTarget } from '../support/knowledge-target.ts';

const cloudConfig = {
  projectId: 'notbad-6be95',
  firebaseStorageBucket: 'notbad-6be95.firebasestorage.app',
  dataConnect: {
    serviceId: 'notbad-6be95-service',
    location: 'europe-west3',
    database: 'notbad-6be95-database',
    instanceId: 'notbad-6be95-instance',
  },
  vertexAi: { model: 'gemini-embedding-001', location: 'europe-west3', dimension: 768 },
};

const cloudEnv = {
  BARBERHQ_TEST_MODE: 'cloud-sql',
  BARBERHQ_ALLOW_TEST_FIXTURES: 'notbad-6be95',
};

it('allows only the explicitly approved fixed cloud SQL target', () => {
  const target = resolveKnowledgeTarget({
    env: cloudEnv,
    configPath: 'config/knowledge-cloud.json',
    config: cloudConfig,
  });
  expect(target).toMatchObject({
    mode: 'cloud-sql',
    projectId: 'notbad-6be95',
    serviceId: 'notbad-6be95-service',
    location: 'europe-west3',
    embeddingLocation: 'europe-west3',
  });
  expect(knowledgeConnectorConfig(target, 'server')).toEqual({
    connector: 'server',
    serviceId: 'notbad-6be95-service',
    location: 'europe-west3',
  });
  expect(knowledgeConnectorConfig(target, 'vector')).toEqual({
    connector: 'vector',
    serviceId: 'notbad-6be95-service',
    location: 'europe-west3',
  });
});

it('blocks cloud SQL mode without the exact fixture approval', () => {
  expect(() =>
    resolveKnowledgeTarget({
      env: { ...cloudEnv, BARBERHQ_ALLOW_TEST_FIXTURES: '' },
      configPath: 'config/knowledge-cloud.json',
      config: cloudConfig,
    }),
  ).toThrow(/explicit.*fixture/i);
});

it('blocks cloud SQL mode when any emulator environment is present', () => {
  expect(() =>
    resolveKnowledgeTarget({
      env: { ...cloudEnv, FUNCTIONS_EMULATOR: 'true' },
      configPath: 'config/knowledge-cloud.json',
      config: cloudConfig,
    }),
  ).toThrow(/emulator/i);
});

it('blocks private config paths and any target outside the fixed allowlist', () => {
  expect(() =>
    resolveKnowledgeTarget({
      env: cloudEnv,
      configPath: '/private/target.json',
      config: cloudConfig,
    }),
  ).toThrow(/fixed.*config/i);
  expect(() =>
    resolveKnowledgeTarget({
      env: { ...cloudEnv, BARBERHQ_TEST_CONFIG: '/private/target.json' },
      configPath: 'config/knowledge-cloud.json',
      config: cloudConfig,
    }),
  ).toThrow(/fixed.*config/i);
  expect(() =>
    resolveKnowledgeTarget({
      env: cloudEnv,
      configPath: 'config/knowledge-cloud.json',
      config: { ...cloudConfig, projectId: 'other-project' },
    }),
  ).toThrow(/target/i);
  expect(() =>
    resolveKnowledgeTarget({
      env: cloudEnv,
      configPath: 'config/knowledge-cloud.json',
      config: {
        ...cloudConfig,
        dataConnect: { ...cloudConfig.dataConnect, serviceId: 'other-service' },
      },
    }),
  ).toThrow(/target/i);
  expect(() =>
    resolveKnowledgeTarget({
      env: cloudEnv,
      configPath: 'config/knowledge-cloud.json',
      config: {
        ...cloudConfig,
        dataConnect: { ...cloudConfig.dataConnect, location: 'us-central1' },
      },
    }),
  ).toThrow(/target/i);
});

it('preserves explicit emulator resolution for the local target', () => {
  const target = resolveKnowledgeTarget({
    env: { BARBERHQ_TEST_MODE: 'emulator', DATA_CONNECT_EMULATOR_HOST: '127.0.0.1:9399' },
    configPath: null,
    config: null,
  });
  expect(target).toMatchObject({
    mode: 'emulator',
    projectId: 'demo-barberhq',
    serviceId: 'barberhq',
    location: 'europe-west1',
    embeddingLocation: 'europe-west3',
  });
  expect(knowledgeConnectorConfig(target, 'server')).toEqual({
    connector: 'server',
    serviceId: 'barberhq',
    location: 'europe-west1',
  });
  expect(knowledgeConnectorConfig(target, 'vector')).toEqual({
    connector: 'vector',
    serviceId: 'barberhq',
    location: 'europe-west1',
  });
});

it('accepts a controller-owned loopback test endpoint only with the explicit matching override', () => {
  expect(
    resolveKnowledgeTarget({
      env: {
        BARBERHQ_TEST_MODE: 'emulator',
        DATA_CONNECT_EMULATOR_HOST: '127.0.0.1:9499',
        BARBERHQ_ISOLATED_DC_HOST: '127.0.0.1:9499',
      },
      configPath: null,
      config: null,
    }),
  ).toMatchObject({ mode: 'emulator' });
  for (const host of ['example.com:9499', '127.0.0.1:443', '127.0.0.1:9399/remote'])
    expect(() =>
      resolveKnowledgeTarget({
        env: {
          BARBERHQ_TEST_MODE: 'emulator',
          DATA_CONNECT_EMULATOR_HOST: host,
          BARBERHQ_ISOLATED_DC_HOST: host,
        },
        configPath: null,
        config: null,
      }),
    ).toThrow();
});
