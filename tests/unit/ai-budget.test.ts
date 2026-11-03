import { describe, expect, it, vi } from 'vitest';
import {
  createAiBudget,
  consumeModelTurn,
  consumeToolCall,
  assertTimeRemaining,
  runWithinBudget,
  runWithReservedTime,
} from '../../functions/src/ai/budget.ts';

describe('AI flow budget', () => {
  it('permits exactly five model turns and eight tool executions', () => {
    const budget = createAiBudget(0, () => 0);
    for (let i = 0; i < 5; i++) consumeModelTurn(budget);
    for (let i = 0; i < 8; i++) consumeToolCall(budget);
    expect(budget.modelTurnsRemaining).toBe(0);
    expect(budget.toolCallsRemaining).toBe(0);
    expect(() => consumeModelTurn(budget)).toThrowError(
      expect.objectContaining({ code: 'MODEL_LIMIT' }),
    );
    expect(() => consumeToolCall(budget)).toThrowError(
      expect.objectContaining({ code: 'TOOL_LIMIT' }),
    );
  });

  it('rejects work after 25 seconds', () => {
    let now = 100;
    const budget = createAiBudget(now, () => now);
    now = 25_100;
    expect(() => assertTimeRemaining(budget)).toThrowError(
      expect.objectContaining({ code: 'TIMEOUT' }),
    );
  });

  it('aborts outstanding work and discards a late provider result', async () => {
    vi.useFakeTimers();
    try {
      const budget = createAiBudget(Date.now(), () => Date.now());
      let complete!: (value: string) => void;
      let signal!: AbortSignal;
      const work = runWithinBudget(budget, (providedSignal) => {
        signal = providedSignal;
        return new Promise<string>((resolve) => {
          complete = resolve;
        });
      });
      const failure = expect(work).rejects.toMatchObject({ code: 'TIMEOUT' });
      await vi.advanceTimersByTimeAsync(25_000);
      await failure;
      expect(signal.aborted).toBe(true);
      complete('too late');
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }
  });
  it('runs work against an earlier deadline and keeps the shared counters', async () => {
    let now = 0;
    const budget = createAiBudget(0, () => now);
    const seen = await runWithReservedTime(budget, 3_000, async (child) => {
      consumeModelTurn(child);
      return child.deadlineMs;
    });
    expect(seen).toBe(22_000);
    expect(budget.modelTurnsRemaining).toBe(4);
    expect(budget.deadlineMs).toBe(25_000);
    now = 22_000;
    await expect(runWithReservedTime(budget, 3_000, async () => 'late')).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    expect(budget.modelTurnsRemaining).toBe(4);
  });
});
