import { describe, expect, it } from 'vitest';
import {
  parseCloudSeedArgs,
  validateCloudSeedTarget,
  safeSeedError,
} from '../../scripts/seed/cloud-demo.ts';
import { validateMemberships } from '../../scripts/seed/business.ts';
import publicExample from '../../config/public.example.json' with { type: 'json' };
import cloud from '../../config/knowledge-cloud.json' with { type: 'json' };

describe('cloud demo seed configuration', () => {
  it('requires explicit paths and exactly one mode', () => {
    expect(
      parseCloudSeedArgs(['--config', 'public.json', '--memberships', 'members.json', '--dry-run']),
    ).toEqual({
      configPath: 'public.json',
      membershipsPath: 'members.json',
      dryRun: true,
    });
    for (const argv of [
      ['--config', 'public.json', '--memberships', 'members.json'],
      ['--config', 'public.json', '--memberships', 'members.json', '--dry-run', '--apply'],
      ['--config', 'public.json', '--memberships', 'members.json', '--apply', '--unknown'],
      [
        '--config',
        'public.json',
        '--config',
        'other.json',
        '--memberships',
        'members.json',
        '--apply',
      ],
    ])
      expect(() => parseCloudSeedArgs(argv)).toThrow('SEED_OPTIONS_INVALID');
  });

  it('accepts only the approved cloud target and rejects emulator flags', () => {
    expect(validateCloudSeedTarget(publicExample, cloud, 'not-bad-stuff-demo', {})).toMatchObject({
      projectId: 'notbad-6be95',
    });
    expect(() =>
      validateCloudSeedTarget(
        { ...publicExample, projectId: 'other' },
        cloud,
        'not-bad-stuff-demo',
        {},
      ),
    ).toThrow('SEED_TARGET_INVALID');
    expect(() =>
      validateCloudSeedTarget(
        publicExample,
        { ...cloud, dataConnect: { ...cloud.dataConnect, location: 'europe-west1' } },
        'not-bad-stuff-demo',
        {},
      ),
    ).toThrow('SEED_TARGET_INVALID');
    expect(() => validateCloudSeedTarget(publicExample, cloud, 'other', {})).toThrow(
      'SEED_TARGET_INVALID',
    );
    expect(() =>
      validateCloudSeedTarget(publicExample, cloud, 'not-bad-stuff-demo', {
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      }),
    ).toThrow('SEED_EMULATOR_FORBIDDEN');
  });

  it('rejects a jointly changed service or location even when both configs agree', () => {
    for (const dataConnect of [
      { ...publicExample.dataConnect, serviceId: 'other-service' },
      { ...publicExample.dataConnect, location: 'europe-west1' },
    ]) {
      const publicConfig = { ...publicExample, dataConnect };
      const cloudConfig = {
        ...cloud,
        dataConnect: {
          ...cloud.dataConnect,
          serviceId: dataConnect.serviceId,
          location: dataConnect.location,
        },
      };
      expect(() =>
        validateCloudSeedTarget(publicConfig, cloudConfig, 'not-bad-stuff-demo', {}),
      ).toThrow('SEED_TARGET_INVALID');
    }
  });

  it('rejects placeholder, duplicate and invalid membership assignments', () => {
    expect(() =>
      validateMemberships([{ uid: 'REPLACE_WITH_UID', role: 'HQ', salonKeys: [] }]),
    ).toThrow('SEED_MEMBERSHIPS_INVALID');
    expect(() =>
      validateMemberships([
        { uid: 'valid-uid', role: 'HQ', salonKeys: [] },
        { uid: 'valid-uid', role: 'SALON', salonKeys: ['legnicka'] },
      ]),
    ).toThrow('SEED_MEMBERSHIPS_INVALID');
    expect(() =>
      validateMemberships([
        { uid: 'valid-uid', role: 'SALON', salonKeys: ['legnicka', 'legnicka'] },
      ]),
    ).toThrow('SEED_MEMBERSHIPS_INVALID');
    expect(() => validateMemberships([{ uid: 'valid-uid', role: 'SALON', salonKeys: [] }])).toThrow(
      'SEED_MEMBERSHIPS_INVALID',
    );
    expect(() =>
      validateMemberships([{ uid: 'valid-uid', role: 'HQ', salonKeys: ['legnicka'] }]),
    ).toThrow('SEED_MEMBERSHIPS_INVALID');
    expect(
      validateMemberships([{ uid: 'valid-uid', role: 'SALON', salonKeys: ['legnicka'] }]),
    ).toHaveLength(1);
  });

  it('sanitizes provider errors without echoing private details', () => {
    const message = safeSeedError(new Error('secret UID, account and token'));
    expect(message).toBe('SEED_OPERATION_FAILED');
    expect(message).not.toContain('secret');
  });
});
