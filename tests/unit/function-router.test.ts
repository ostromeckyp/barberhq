import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createRouter } from '../../functions/src/routing/router.ts';
import { commandHandlers } from '../../functions/src/routing/commands.ts';
import { aiHandlers } from '../../functions/src/routing/ai.ts';
import { aiOps, commandOps } from '../../shared/contracts/functions/index.ts';

// firebase-functions is installed in functions/ only, so its types and classes are reached
// through the router instead of a direct import.
type CallableRequest = Parameters<ReturnType<typeof createRouter>>[0];
type HttpsError = Error & { code: string };

const rawRequest = { headers: { authorization: 'Bearer t' } };

function request(data: unknown) {
  return { data, auth: { uid: 'u' }, rawRequest } as unknown as CallableRequest;
}

async function rejected(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

describe('function router', () => {
  it('passes input as data and keeps the rest of the request', async () => {
    const op = { run: vi.fn(async (r: CallableRequest) => r) };
    const original = request({ op: 'a', input: { x: 1 } });
    const result = (await createRouter({ a: op })(original)) as CallableRequest;
    expect(op.run).toHaveBeenCalledOnce();
    expect(result).toEqual({ ...original, data: { x: 1 } });
    expect(result.rawRequest).toBe(rawRequest);
    expect(result.auth).toBe(original.auth);
  });

  for (const [name, data] of [
    ['rejects an unknown op', { op: 'nope', input: {} }],
    ['rejects a missing op', { input: {} }],
    ['rejects a missing input', { op: 'a' }],
    ['rejects non-object data', 'a'],
  ] as const) {
    it(name, async () => {
      const op = { run: vi.fn() };
      const error = await rejected(
        Promise.resolve().then(() => createRouter({ a: op })(request(data))),
      );
      expect((error as Error).constructor.name).toBe('HttpsError');
      expect((error as HttpsError).code).toBe('invalid-argument');
      expect(op.run).not.toHaveBeenCalled();
    });
  }

  it('rejects inherited keys as op', async () => {
    const op = { run: vi.fn() };
    const error = await rejected(
      Promise.resolve().then(() => createRouter({ a: op })(request({ op: 'toString' }))),
    );
    expect((error as HttpsError).code).toBe('invalid-argument');
  });

  it('propagates handler errors unchanged', async () => {
    const invalid = await rejected(Promise.resolve().then(() => createRouter({})(request('a'))));
    const Https = (invalid as Error).constructor as new (code: string, message: string) => Error;
    const thrown = new Https('permission-denied', 'x');
    const op = {
      run: vi.fn(async () => {
        throw thrown;
      }),
    };
    expect(
      await rejected(Promise.resolve(createRouter({ a: op })(request({ op: 'a', input: null })))),
    ).toBe(thrown);
  });

  it('routes transcribeOrder on the ai callable', () => {
    expect(aiOps).toContain('transcribeOrder');
    expect(aiHandlers.transcribeOrder).toBeDefined();
  });

  it('covers the contract exactly', () => {
    expect(Object.keys(commandHandlers).sort()).toEqual([...commandOps].sort());
    expect(Object.keys(aiHandlers).sort()).toEqual([...aiOps].sort());
    const ai = new Set<string>(aiOps);
    expect(commandOps.filter((op) => ai.has(op))).toEqual([]);
  });

  it('routes the push token ops', () => {
    for (const op of ['registerPushToken', 'unregisterPushToken'] as const) {
      expect(commandOps).toContain(op);
      expect(commandHandlers[op]).toBeDefined();
    }
  });

  it('index exports only the routed and standalone functions', () => {
    const source = readFileSync('functions/src/index.ts', 'utf8');
    const names = [...source.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
    expect(source).not.toMatch(/^export (?!const )/m);
    expect(names.sort()).toEqual([
      'ai',
      'commands',
      'getSourcePdf',
      'processKnowledgeTask',
      'uploadKnowledgePdf',
    ]);
  });
});
