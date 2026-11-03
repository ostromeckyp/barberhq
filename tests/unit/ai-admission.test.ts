import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAiAdmission } from '../../functions/src/ai/admission.ts';
import {
  createAiAdminDependencies,
  createAiRuntimeProfile,
  createAiUserEndpoint,
} from '../../functions/src/ai/context.ts';
import { createBudgetedGenerator } from '../../functions/src/ai/runtime.ts';

const member = {
  uid: 'uid-1',
  businessId: 'business-1',
  role: 'SALON' as const,
  salonIds: ['salon-1'],
};

describe('AI admission and caller security', () => {
  it('accepts 2000 characters, rejects 2001 and blank input before charging', async () => {
    let charges = 0;
    const admission = createAiAdmission({
      readActor: async () => member,
      increment: async () => {
        charges++;
        return { count: charges };
      },
    });
    const actor = await admission.resolveActor('uid-1');
    await admission.admitAiCall(actor, 'replenishment', 'x'.repeat(2000), new Date(0));
    await expect(
      admission.admitAiCall(actor, 'procedure', 'x'.repeat(2001), new Date(0)),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      admission.admitAiCall(actor, 'procedure', '  ', new Date(0)),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(charges).toBe(1);
  });

  it('admits the transcription endpoint for salon and HQ, counted once, and rejects unknown ones', async () => {
    let charges = 0;
    const admission = createAiAdmission({
      readActor: async () => member,
      increment: async () => ({ count: ++charges }),
    });
    const actor = await admission.resolveActor('uid-1');
    await admission.admitAiCall(actor, 'transcription', 'audio audio/webm 1200B', new Date(0));
    expect(charges).toBe(1);
    await expect(
      admission.admitAiCall(actor, 'nope' as never, 'x', new Date(0)),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects forged actor and mismatched fresh membership before charging', async () => {
    let charges = 0;
    let current = member;
    const admission = createAiAdmission({
      readActor: async () => current,
      increment: async () => {
        charges++;
        return { count: 1 };
      },
    });
    await expect(
      admission.admitAiCall({ ...member } as never, 'procedure', 'question', new Date()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const actor = await admission.resolveActor('uid-1');
    current = { ...member, businessId: 'business-2' };
    await expect(
      admission.admitAiCall(actor, 'procedure', 'question', new Date()),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(charges).toBe(0);
  });

  it('distinguishes the twenty-first admission from unauthorized and does not refund failures', async () => {
    let count = 0;
    const admission = createAiAdmission({
      readActor: async () => member,
      increment: async () => (++count <= 20 ? { count } : null),
    });
    const actor = await admission.resolveActor('uid-1');
    const first = await admission.admitAiCall(actor, 'procedure', 'input', new Date(0));
    const failedProvider = createBudgetedGenerator(
      {
        provider: 'vertex',
        projectId: 'notbad-6be95',
        location: 'eu',
        modelId: 'gemini-3.8-flash',
      },
      async () => {
        throw Error('provider failed');
      },
    );
    await expect(failedProvider(first, 'question')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    for (let i = 1; i < 20; i++)
      await admission.admitAiCall(
        actor,
        i % 2 ? 'procedure' : 'replenishment',
        'input',
        new Date(0),
      );
    await expect(
      admission.admitAiCall(actor, 'procedure', 'input', new Date(0)),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(count).toBe(21);
  });

  it('caps admissions at 20 per hour in the SQL window', () => {
    const sql = readFileSync(
      new URL('../../dataconnect/server/ai/admission.gql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain('ai_usage_window.count < 20');
  });

  it('requires revoked-token verification, UID consistency and App Check before operation', async () => {
    let operations = 0;
    const endpoint = createAiUserEndpoint(
      async () => {
        operations++;
        return 'ok';
      },
      {
        verifyAuth: async (token, checkRevoked) =>
          token === 'valid' && checkRevoked ? 'uid-1' : null,
        verifyAppCheck: async (token) => token === 'app-valid',
      },
      createAiRuntimeProfile({ emulator: false, projectId: 'notbad-6be95' }),
    );
    const base = {
      data: { message: 'hello' },
      authUid: 'uid-1',
      idToken: 'valid',
      appCheckToken: 'app-valid',
    };
    await expect(endpoint({ ...base, authUid: 'other' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(endpoint({ ...base, appCheckToken: undefined })).rejects.toMatchObject({
      code: 'APP_CHECK_REQUIRED',
    });
    expect(operations).toBe(0);
    expect(await endpoint(base)).toBe('ok');
  });

  it('permits App Check bypass only for the explicit demo project with loopback emulators', async () => {
    expect(() =>
      createAiRuntimeProfile({
        emulator: true,
        projectId: 'notbad-6be95',
        authHost: '127.0.0.1:9099',
        sqlHost: '127.0.0.1:9399',
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_CONFIG' }));
    expect(() =>
      createAiRuntimeProfile({
        emulator: true,
        projectId: 'demo-barberhq',
        authHost: 'auth.example:9099',
        sqlHost: '127.0.0.1:9399',
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_CONFIG' }));
    const profile = createAiRuntimeProfile({
      emulator: true,
      projectId: 'demo-barberhq',
      authHost: '127.0.0.1:9099',
      sqlHost: 'localhost:9399',
    });
    const endpoint = createAiUserEndpoint(
      async () => 'ok',
      {
        verifyAuth: async () => 'uid-1',
        verifyAppCheck: async () => false,
      },
      profile,
    );
    expect(await endpoint({ data: { message: 'hello' }, authUid: 'uid-1', idToken: 'valid' })).toBe(
      'ok',
    );
    await expect(
      createAiUserEndpoint(
        async () => 'bad',
        {
          verifyAuth: async () => 'uid-1',
          verifyAppCheck: async () => false,
        },
        { demoLoopbackEmulator: true } as never,
      )({ data: { message: 'hello' }, authUid: 'uid-1', idToken: 'valid' }),
    ).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });

  it('uses Firebase Admin revoked-token and App Check verification', async () => {
    let revoked: unknown;
    const deps = createAiAdminDependencies(
      {
        verifyIdToken: async (_token: string, flag: boolean) => {
          revoked = flag;
          return { uid: 'uid-1' };
        },
      } as never,
      { verifyToken: async () => ({ appId: 'demo' }) } as never,
    );
    expect(await deps.verifyAuth('token', true)).toBe('uid-1');
    expect(revoked).toBe(true);
    expect(await deps.verifyAppCheck('app-token')).toBe(true);
  });
  it('normalizes unexpected operation failures without exposing SDK details', async () => {
    const endpoint = createAiUserEndpoint(
      async () => {
        throw Error('secret authorization header and prompt');
      },
      {
        verifyAuth: async () => 'uid-1',
        verifyAppCheck: async () => true,
      },
      createAiRuntimeProfile({ emulator: false, projectId: 'notbad-6be95' }),
    );
    await expect(
      endpoint({
        data: { message: 'hello' },
        authUid: 'uid-1',
        idToken: 'valid',
        appCheckToken: 'valid',
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: 'SERVICE_UNAVAILABLE' });
  });

  it('times out a hanging SQL admission and discards a late success', async () => {
    vi.useFakeTimers();
    try {
      let finish!: (value: { count: number }) => void;
      const admission = createAiAdmission({
        readActor: async () => member,
        increment: async () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      });
      const actor = await admission.resolveActor('uid-1');
      const pending = admission.admitAiCall(actor, 'procedure', 'question', new Date(0));
      const failure = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(25_000);
      await failure;
      finish({ count: 1 });
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start a quota mutation after the fresh actor read crosses the deadline', async () => {
    let now = 0;
    let reads = 0;
    let charges = 0;
    const admission = createAiAdmission(
      {
        readActor: async () => {
          if (++reads === 2) now = 25_001;
          return member;
        },
        increment: async () => {
          charges++;
          return { count: charges };
        },
      },
      () => now,
    );
    const actor = await admission.resolveActor('uid-1');
    await expect(
      admission.admitAiCall(actor, 'procedure', 'question', new Date(0)),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(charges).toBe(0);
  });
});
