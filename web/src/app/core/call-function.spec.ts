import { beforeEach, describe, expect, it, vi } from 'vitest';
import { httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import { callFunction, setCallObserver } from './call-function';

vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }));

describe('callFunction', () => {
  const functions = {} as Functions;
  const callable = vi.fn();
  beforeEach(() => {
    vi.mocked(httpsCallable).mockReset();
    callable.mockReset();
    vi.mocked(httpsCallable).mockReturnValue(callable as never);
  });

  it('routes a command op through the commands callable', async () => {
    callable.mockResolvedValue({ data: { ok: true } });
    const input = { requestId: 'r1' };
    const result = await callFunction(
      { functions, appCheck: async () => null },
      'submitRequest',
      input,
    );
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'commands');
    expect(callable).toHaveBeenCalledWith({ op: 'submitRequest', input });
    expect(result).toEqual({ ok: true });
  });

  it('routes an AI op through the ai callable', async () => {
    callable.mockResolvedValue({ data: 1 });
    await callFunction({ functions, appCheck: async () => null }, 'prepareReplenishment', { a: 1 });
    expect(httpsCallable).toHaveBeenCalledWith(functions, 'ai');
    expect(callable).toHaveBeenCalledWith({ op: 'prepareReplenishment', input: { a: 1 } });
  });

  it('waits for App Check before creating the callable', async () => {
    callable.mockResolvedValue({ data: 1 });
    let release!: () => void;
    const appCheck = () => new Promise<null>((resolve) => (release = () => resolve(null)));
    const pending = callFunction({ functions, appCheck }, 'submitRequest', null);
    await Promise.resolve();
    expect(httpsCallable).not.toHaveBeenCalled();
    release();
    await pending;
    expect(httpsCallable).toHaveBeenCalledOnce();
  });

  it('rejects with the callable error unchanged', async () => {
    const error = Object.assign(new Error('x'), { code: 'functions/aborted' });
    callable.mockRejectedValue(error);
    await expect(
      callFunction({ functions, appCheck: async () => null }, 'submitRequest', {}),
    ).rejects.toBe(error);
  });

  it('reports each call to the observer with outcome, duration and code', async () => {
    const observer = vi.fn();
    setCallObserver(observer);
    try {
      callable.mockResolvedValueOnce({ data: 1 });
      await callFunction({ functions, appCheck: async () => null }, 'submitRequest', {});
      expect(observer).toHaveBeenLastCalledWith(
        'submitRequest',
        'ok',
        expect.any(Number),
        undefined,
        undefined,
      );
      callable.mockRejectedValueOnce(
        Object.assign(new Error('RATE_LIMITED'), { code: 'functions/resource-exhausted' }),
      );
      await callFunction(
        { functions, appCheck: async () => null },
        'prepareReplenishment',
        {},
      ).catch(() => undefined);
      expect(observer).toHaveBeenLastCalledWith(
        'prepareReplenishment',
        'error',
        expect.any(Number),
        'functions/resource-exhausted',
        'RATE_LIMITED',
      );
      callable.mockRejectedValueOnce(
        Object.assign(new Error('Sign in to continue.'), { code: 'functions/unauthenticated' }),
      );
      await callFunction({ functions, appCheck: async () => null }, 'submitRequest', {}).catch(
        () => undefined,
      );
      expect(observer).toHaveBeenLastCalledWith(
        'submitRequest',
        'error',
        expect.any(Number),
        'functions/unauthenticated',
        undefined,
      );
    } finally {
      setCallObserver(null);
    }
  });

  it('keeps the call working when the observer throws', async () => {
    setCallObserver(() => {
      throw new Error('observer');
    });
    try {
      callable.mockResolvedValueOnce({ data: 2 });
      await expect(
        callFunction({ functions, appCheck: async () => null }, 'submitRequest', {}),
      ).resolves.toBe(2);
    } finally {
      setCallObserver(null);
    }
  });
});
