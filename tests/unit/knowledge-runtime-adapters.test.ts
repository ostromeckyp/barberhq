import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { authorizeReviewVersion } from '../../functions/src/knowledge/callables.js';
import { publicError } from '../../functions/src/knowledge/callables.js';
import { KnowledgeError } from '../../functions/src/knowledge/repository.js';
import {
  createKnowledgeRuntimeConfig,
  createUserEndpoint,
} from '../../functions/src/knowledge/runtime.js';
import { MemberRole } from '@barberhq/server';

describe('knowledge runtime adapter contracts', () => {
  function assertRevocationCheckedAuth(source: string, file: string) {
    if (
      !/verifyAuth:\s*async\s*\(?token\)?\s*=>\s*\{\s*try\s*\{\s*return\s*\(await getAuth\(\)\.verifyIdToken\(token,\s*true\)\)\.uid;\s*\}\s*catch\s*\{\s*return null;\s*\}\s*\}/.test(
        source,
      )
    )
      throw new Error(`${file} must verify Firebase Auth tokens with checkRevoked=true`);
  }

  it('RED/GREEN: requires demo project and loopback emulator hosts locally', () => {
    const local = createKnowledgeRuntimeConfig({
      emulator: true,
      projectId: 'demo-barberhq',
      authHost: '127.0.0.1:9099',
      sqlHost: '127.0.0.1:9399',
      firebaseStorageHost: '127.0.0.1:9199',
      storageHost: 'http://127.0.0.1:9199',
      serviceId: 'barberhq',
      sqlLocation: 'europe-west1',
      bucket: '',
      vertexProject: 'notbad-6be95',
      vertexModel: 'gemini-embedding-001',
      vertexLocation: 'europe-west3',
      vertexDimension: '768',
    });
    expect(local.serviceId).toBe('barberhq');
    expect(
      createKnowledgeRuntimeConfig({
        emulator: true,
        projectId: 'demo-barberhq',
        authHost: '127.0.0.1:9099',
        sqlHost: '127.0.0.1:9399',
        firebaseStorageHost: '127.0.0.1:9199',
      }).bucket,
    ).toBe('demo-barberhq.appspot.com');
    expect(
      createKnowledgeRuntimeConfig({
        emulator: true,
        projectId: 'demo-barberhq',
        authHost: '127.0.0.1:9099',
        sqlHost: '127.0.0.1:9399',
        storageHost: 'http://127.0.0.1:9199',
      }).bucket,
    ).toBe('demo-barberhq.appspot.com');
    expect(() =>
      createKnowledgeRuntimeConfig({
        emulator: true,
        projectId: 'demo-barberhq',
        authHost: '127.0.0.1:9099',
        sqlHost: '127.0.0.1:9399',
      }),
    ).toThrow();
    expect(() =>
      createKnowledgeRuntimeConfig({
        emulator: true,
        projectId: 'notbad-6be95',
        authHost: 'localhost:9099',
        sqlHost: '127.0.0.1:9399',
        firebaseStorageHost: '127.0.0.1:9199',
        storageHost: 'http://127.0.0.1:9199',
        serviceId: 'barberhq',
        sqlLocation: 'europe-west1',
        bucket: '',
        vertexProject: 'demo-barberhq',
        vertexModel: 'gemini-embedding-001',
        vertexLocation: 'europe-west3',
        vertexDimension: '768',
      }),
    ).toThrow();
    expect(() =>
      createKnowledgeRuntimeConfig({
        emulator: true,
        projectId: 'demo-barberhq',
        authHost: 'localhost:9099',
        sqlHost: 'localhost:9399',
        firebaseStorageHost: '127.0.0.1:9199',
        storageHost: 'http://localhost:9199',
      }),
    ).toThrow();
    expect(() =>
      createKnowledgeRuntimeConfig({
        emulator: true,
        projectId: 'demo-barberhq',
        authHost: 'localhost:70000',
        sqlHost: 'localhost:9399',
        firebaseStorageHost: '127.0.0.1:9199',
        storageHost: 'http://127.0.0.1:9199',
      }),
    ).toThrow();
  });

  it('RED/GREEN: rejects emulator endpoints in production and config drift', () => {
    const base = {
      emulator: false,
      projectId: 'notbad-6be95',
      serviceId: 'notbad-6be95-service',
      sqlLocation: 'europe-west3',
      bucket: 'notbad-6be95.firebasestorage.app',
      vertexProject: 'notbad-6be95',
      vertexModel: 'gemini-embedding-001',
      vertexLocation: 'europe-west3',
      vertexDimension: '768',
    };
    expect(() => createKnowledgeRuntimeConfig({ ...base, sqlHost: '127.0.0.1:9399' })).toThrow();
    expect(() => createKnowledgeRuntimeConfig({ ...base, vertexDimension: '512' })).toThrow();
    expect(createKnowledgeRuntimeConfig(base).bucket).toBe(base.bucket);
    expect(() =>
      createKnowledgeRuntimeConfig({ ...base, firebaseStorageHost: '127.0.0.1:9199' }),
    ).toThrow();
  });

  it('RED/GREEN: requires fresh Auth and App Check and does not accept client actor fields', async () => {
    const service = { run: vi.fn(async (uid: string, dto: unknown) => ({ uid, dto })) };
    const handler = createUserEndpoint(service.run, {
      verifyAuth: vi.fn(async (token: string) => (token === 'fresh' ? 'hq-1' : null)),
      verifyAppCheck: vi.fn(async (token: string) => token === 'app-ok'),
    });
    await expect(
      handler({
        data: {},
        authUid: 'hq-1',
        idToken: 'revoked',
        appCheckToken: 'app-ok',
        emulator: false,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(
      handler({ data: {}, authUid: 'hq-1', idToken: 'fresh', emulator: false }),
    ).rejects.toMatchObject({ code: 'APP_CHECK_REQUIRED' });
    await expect(
      handler({
        data: { actorUid: 'attacker' },
        authUid: 'hq-1',
        idToken: 'fresh',
        appCheckToken: 'app-ok',
        emulator: false,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      handler({
        data: {},
        authUid: 'hq-1',
        idToken: 'fresh',
        appCheckToken: 'app-ok',
        emulator: false,
      }),
    ).resolves.toEqual({ uid: 'hq-1', dto: {} });
  });

  it('RED/GREEN: exports the exact document endpoints and task declaration', () => {
    const entry = readFileSync(new URL('../../functions/src/index.ts', import.meta.url), 'utf8');
    const worker = readFileSync(
      new URL('../../functions/src/knowledge/worker.ts', import.meta.url),
      'utf8',
    );
    const source = readFileSync(
      new URL('../../functions/src/knowledge/source.ts', import.meta.url),
      'utf8',
    );
    for (const name of [
      'createDocumentUpload',
      'reviewAndPublishDocument',
      'retryDocumentProcessing',
      'deleteKnowledgeVersion',
      'uploadKnowledgePdf',
      'processKnowledgeTask',
      'getSourcePdf',
    ]) {
      expect(entry).toContain(`export const ${name} =`);
    }
    expect(worker).toMatch(/region:\s*'europe-west1',\s*timeoutSeconds:\s*300/);
    expect(worker).toMatch(/maxAttempts:\s*3,\s*minBackoffSeconds:\s*360/);
    expect(worker).toMatch(/maxConcurrentDispatches:\s*2/);
    expect(worker).toMatch(/invoker:\s*\[RUNTIME_INVOKER\]/);
    expect(worker).toContain("'baberhq-runtime@notbad-6be95.iam.gserviceaccount.com'");
    expect(source).not.toContain("from './runtime.js'");
  });

  it('RED/GREEN: denies salon and foreign HQ before exposing a review version', async () => {
    const version = vi.fn(async () => ({ businessId: 'business-1' }));
    const salon = await authorizeReviewVersion('salon-1', 'version-1', {
      readMembership: vi.fn(async () => ({ role: MemberRole.SALON, businessId: 'business-1' })),
      version,
    }).catch((error) => error);
    expect(salon).toMatchObject({ code: 'FORBIDDEN' });
    expect(version).not.toHaveBeenCalled();

    const foreign = await authorizeReviewVersion('hq-1', 'version-1', {
      readMembership: vi.fn(async () => ({ role: MemberRole.HQ, businessId: 'business-1' })),
      version: vi.fn(async () => ({ businessId: 'business-2' })),
    }).catch((error) => error);
    expect(foreign).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('RED/GREEN: returns stable domain codes in HttpsError details without raw messages', () => {
    let known: unknown;
    try {
      publicError(new KnowledgeError('UNAUTHENTICATED', 'private SDK detail'));
    } catch (error) {
      known = error;
    }
    expect(known).toMatchObject({
      code: 'unauthenticated',
      message: 'UNAUTHENTICATED',
      details: { code: 'UNAUTHENTICATED' },
    });
    expect(String(known)).not.toContain('private SDK detail');
    let unknown: unknown;
    try {
      publicError(new Error('private SDK detail'));
    } catch (error) {
      unknown = error;
    }
    expect(unknown).toMatchObject({
      code: 'unavailable',
      message: 'OUTCOME_UNKNOWN',
      details: { code: 'OUTCOME_UNKNOWN' },
    });
    expect(String(unknown)).not.toContain('private SDK detail');
  });

  it('RED/GREEN: production callable, upload, and source adapters check token revocation', () => {
    const files = ['callables.ts', 'upload.ts', 'source.ts'];
    const sources = files.map((file) =>
      readFileSync(new URL(`../../functions/src/knowledge/${file}`, import.meta.url), 'utf8'),
    );
    for (let index = 0; index < files.length; index++)
      assertRevocationCheckedAuth(sources[index]!, files[index]!);
  });

  it('RED: a controlled checkRevoked=false mutation fails the production wiring assertion', () => {
    const source = readFileSync(
      new URL('../../functions/src/knowledge/callables.ts', import.meta.url),
      'utf8',
    );
    const mutated = source.replace(/verifyIdToken\(token,\s*true\)/, 'verifyIdToken(token, false)');
    expect(mutated).not.toBe(source);
    expect(() => assertRevocationCheckedAuth(mutated, 'callables.ts')).toThrow('checkRevoked=true');
  });
});
