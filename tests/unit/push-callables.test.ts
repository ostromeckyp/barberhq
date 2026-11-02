import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  notifier: vi.fn(),
  execute: vi.fn(),
  upsert: vi.fn(),
  del: vi.fn(),
}));
vi.mock('../../functions/src/stock/runtime.ts', () => ({
  stockConnectorConfig: () => ({ serviceId: 's', location: 'l', connector: 'c' }),
}));
vi.mock('@barberhq/server', () => ({ upsertPushToken: m.upsert, deletePushToken: m.del }));
vi.mock('../../functions/src/generated/esm/index.esm.js', () => ({
  upsertPushToken: m.upsert,
  deletePushToken: m.del,
}));
vi.mock('../../functions/src/push/sender.ts', () => ({ notifyRequestState: m.notifier }));
vi.mock('../../functions/src/stock/repository.ts', () => ({
  StockRepository: class {
    execute = m.execute;
  },
}));

import {
  initializeApp,
  getApps,
} from '../../functions/node_modules/firebase-admin/lib/app/index.js';
import { stockCommand } from '../../functions/src/stock/commands.ts';
import {
  registerPushTokenFunction,
  unregisterPushTokenFunction,
} from '../../functions/src/push/callables.ts';

type Req = Parameters<ReturnType<typeof stockCommand>['run']>[0];
const call = (
  fn: { run: (r: Req) => unknown },
  data: unknown,
  auth: { uid: string } | null = { uid: 'u1' },
) => Promise.resolve(fn.run({ data, auth } as unknown as Req));
const code = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as { code: string }).code;
const key = '11111111-1111-4111-8111-111111111111';
const inputs = {
  APPROVE: {
    requestId: 'r1',
    expectedRevision: 1,
    idempotencyKey: key,
    inventoryVersions: [{ productId: 'p', expectedHqInventoryVersion: 1 }],
  },
  REJECT: { requestId: 'r1', expectedRevision: 1, idempotencyKey: key, reason: 'No' },
  DISPATCH: { requestId: 'r1', expectedRevision: 1, idempotencyKey: key },
} as const;
const result = (replayed: boolean) => ({
  actionReceiptId: 'a',
  requestId: 'r1',
  state: 'RESERVED',
  revision: 2,
  replayed,
});

beforeEach(() => {
  if (!getApps().length) initializeApp({ projectId: 'demo-barberhq' });
  vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
  vi.stubEnv('GCLOUD_PROJECT', 'demo-barberhq');
  vi.stubEnv('DATA_CONNECT_EMULATOR_HOST', '127.0.0.1:9399');
  for (const f of Object.values(m)) f.mockReset();
});

describe('stockCommand notifications', () => {
  it('notifies once after a fresh APPROVE', async () => {
    m.execute.mockResolvedValue(result(false));
    const out = await call(stockCommand('APPROVE') as never, inputs.APPROVE);
    expect(out).toEqual(result(false));
    expect(m.notifier).toHaveBeenCalledOnce();
    expect(m.notifier.mock.calls[0]![1]).toBe('r1');
  });

  it('does not notify on replay', async () => {
    m.execute.mockResolvedValue(result(true));
    await call(stockCommand('APPROVE') as never, inputs.APPROVE);
    expect(m.notifier).not.toHaveBeenCalled();
  });

  for (const type of ['REJECT', 'DISPATCH'] as const)
    it(`notifies once after a fresh ${type}`, async () => {
      m.execute.mockResolvedValue(result(false));
      await call(stockCommand(type) as never, inputs[type]);
      expect(m.notifier).toHaveBeenCalledOnce();
      expect(m.notifier.mock.calls[0]![1]).toBe('r1');
    });

  it('does not notify for RECEIVE or SUBMIT', async () => {
    m.execute.mockResolvedValue(result(false));
    await call(stockCommand('RECEIVE') as never, {
      requestId: 'r1',
      expectedRevision: 1,
      idempotencyKey: key,
      items: [{ productId: 'p', receivedQuantity: 1 }],
      allIntact: true,
    });
    expect(m.execute).toHaveBeenCalledTimes(1);
    await call(stockCommand('SUBMIT') as never, {
      salonId: 's',
      items: [{ productId: 'p', quantity: 1 }],
      idempotencyKey: key,
    });
    expect(m.execute).toHaveBeenCalledTimes(2);
    expect(m.notifier).not.toHaveBeenCalled();
  });

  it('returns the result even when the notifier throws', async () => {
    m.execute.mockResolvedValue(result(false));
    m.notifier.mockRejectedValue(new Error('x'));
    await expect(call(stockCommand('REJECT') as never, inputs.REJECT)).resolves.toEqual(
      result(false),
    );
  });
});

describe('push token callables', () => {
  const reg = () => registerPushTokenFunction() as never;
  const unreg = () => unregisterPushTokenFunction() as never;

  it('registers for the caller', async () => {
    m.upsert.mockResolvedValue({});
    expect(await call(reg(), { token: 't', locale: 'pl' })).toEqual({ ok: true });
    expect(m.upsert).toHaveBeenCalledWith(expect.anything(), {
      uid: 'u1',
      token: 't',
      locale: 'pl',
    });
  });

  it('requires auth and valid input', async () => {
    expect(await code(call(reg(), { token: 't', locale: 'pl' }, null))).toBe('unauthenticated');
    expect(await code(call(reg(), { token: '', locale: 'pl' }))).toBe('invalid-argument');
    expect(await code(call(reg(), { token: 't', locale: 'de' }))).toBe('invalid-argument');
    expect(await code(call(unreg(), { token: 'x'.repeat(4097) }))).toBe('invalid-argument');
  });

  it('maps the FORBIDDEN check to permission-denied', async () => {
    m.upsert.mockRejectedValue(new Error('FORBIDDEN: check failed'));
    expect(await code(call(reg(), { token: 't', locale: 'en' }))).toBe('permission-denied');
  });

  it('unregisters for the caller', async () => {
    m.del.mockResolvedValue({});
    expect(await call(unreg(), { token: 't' })).toEqual({ ok: true });
    expect(m.del).toHaveBeenCalledWith(expect.anything(), { uid: 'u1', token: 't' });
  });
});
