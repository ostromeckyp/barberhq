import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeAppCheck } from 'firebase/app-check';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth';
import { runtimeConfig } from './public-config';
import { createFirebase } from './firebase.providers';
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from './generated';
import type { PublicConfig } from '../../../../scripts/config/public-config';

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'app' })) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  initializeAuth: vi.fn(() => ({ name: 'auth' })),
  connectAuthEmulator: vi.fn(),
  indexedDBLocalPersistence: { type: 'indexeddb' },
  browserLocalPersistence: { type: 'local' },
}));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: vi.fn(() => ({ name: 'appcheck' })),
  ReCaptchaEnterpriseProvider: vi.fn(),
}));
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
}));
vi.mock('firebase/data-connect', () => ({
  getDataConnect: vi.fn(() => ({})),
  connectDataConnectEmulator: vi.fn(),
}));

describe('createFirebase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeConfig.publicConfig = {
      projectId: 'p',
      firebase: { projectId: 'p' },
      functionsRegion: 'europe-west1',
      dataConnect: {
        serviceId: connectorConfig.service,
        location: connectorConfig.location,
        browserConnectorId: connectorConfig.connector,
      },
      appCheck: { siteKey: 'key' },
    } as unknown as PublicConfig;
    runtimeConfig.useEmulators = false;
  });

  it('creates auth without the popup resolver', () => {
    createFirebase();
    expect(getAuth).not.toHaveBeenCalled();
    const args = vi.mocked(initializeAuth).mock.calls[0];
    expect(args[1]).toEqual({ persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    expect(args[1]).not.toHaveProperty('popupRedirectResolver');
  });

  it('initialises App Check before Data Connect, so no query goes out without a token', () => {
    createFirebase();
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(vi.mocked(initializeAppCheck).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getDataConnect).mock.invocationCallOrder[0],
    );
  });

  it('returns the same App Check instance on every use', async () => {
    const firebase = createFirebase();
    const first = await firebase.appCheck();
    const second = await firebase.appCheck();
    expect(initializeAppCheck).toHaveBeenCalledTimes(1);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it('resolves null without initialising App Check in emulator mode', async () => {
    runtimeConfig.useEmulators = true;
    (runtimeConfig.publicConfig as { projectId: string }).projectId = 'demo-x';
    const firebase = createFirebase();
    await expect(firebase.appCheck()).resolves.toBeNull();
    expect(initializeAppCheck).not.toHaveBeenCalled();
  });
});
