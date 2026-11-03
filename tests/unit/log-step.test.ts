import { describe, expect, it, vi } from 'vitest';
import { logStep } from '../../functions/src/logging/log-step.ts';

describe('logStep', () => {
  it('logs ok with duration and details, and returns the result', async () => {
    const log = vi.fn();
    expect(await logStep('knowledge.task', async () => 7, { kind: 'EXTRACT' }, log)).toBe(7);
    expect(log).toHaveBeenCalledWith(
      'INFO',
      expect.objectContaining({
        source: 'functions',
        event: 'knowledge.task',
        outcome: 'ok',
        details: { kind: 'EXTRACT' },
      }),
    );
    expect(typeof log.mock.calls[0][1].durationMs).toBe('number');
  });

  it('logs an error with the error name only and rethrows it', async () => {
    const log = vi.fn();
    const thrown = new TypeError('secret payload');
    await expect(
      logStep(
        'push.notify',
        async () => {
          throw thrown;
        },
        {},
        log,
      ),
    ).rejects.toBe(thrown);
    expect(log).toHaveBeenCalledWith(
      'WARNING',
      expect.objectContaining({ event: 'push.notify', outcome: 'error', code: 'TypeError' }),
    );
    expect(JSON.stringify(log.mock.calls[0][1])).not.toContain('secret payload');
  });

  it('accepts details computed from the result', async () => {
    const log = vi.fn();
    await logStep(
      'knowledge.source',
      async () => 404,
      (status) => ({ status }),
      log,
    );
    expect(log.mock.calls[0][1].details).toEqual({ status: 404 });
  });
});
