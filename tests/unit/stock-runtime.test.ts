import { expect, it } from 'vitest';
import { stockConnectorConfig } from '../../functions/src/stock/runtime.ts';

it('uses the approved cloud SQL target for the production project', () => {
  expect(
    stockConnectorConfig({
      emulator: false,
      projectId: 'notbad-6be95',
      emulatorHost: '',
      serviceId: 'notbad-6be95-service',
      location: 'europe-west3',
    }),
  ).toEqual({ connector: 'server', serviceId: 'notbad-6be95-service', location: 'europe-west3' });
});

it('rejects a cloud process pointed at an emulator or another project or SQL target', () => {
  const cloud = {
    emulator: false,
    projectId: 'notbad-6be95',
    emulatorHost: '',
    serviceId: 'notbad-6be95-service',
    location: 'europe-west3',
  };
  expect(() => stockConnectorConfig({ ...cloud, emulatorHost: '127.0.0.1:9399' })).toThrow();
  expect(() => stockConnectorConfig({ ...cloud, projectId: 'demo-barberhq' })).toThrow();
  expect(() => stockConnectorConfig({ ...cloud, serviceId: 'barberhq' })).toThrow();
  expect(() => stockConnectorConfig({ ...cloud, location: 'europe-west1' })).toThrow();
});

it('uses only the local SQL emulator and demo project together', () => {
  expect(
    stockConnectorConfig({
      emulator: true,
      projectId: 'demo-barberhq',
      emulatorHost: '127.0.0.1:9399',
    }),
  ).toEqual({ connector: 'server', serviceId: 'barberhq', location: 'europe-west1' });
  expect(() =>
    stockConnectorConfig({
      emulator: true,
      projectId: 'notbad-6be95',
      emulatorHost: '127.0.0.1:9399',
    }),
  ).toThrow();
  expect(() =>
    stockConnectorConfig({
      emulator: true,
      projectId: 'demo-barberhq',
      emulatorHost: 'remote.example:9399',
    }),
  ).toThrow();
  expect(() =>
    stockConnectorConfig({ emulator: true, projectId: 'demo-barberhq', emulatorHost: '' }),
  ).toThrow();
});
