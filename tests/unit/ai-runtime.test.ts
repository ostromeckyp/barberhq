import { afterEach, describe, expect, it, vi } from 'vitest';
import { GenkitError } from '../../functions/node_modules/genkit/lib/index.mjs';
import { createAiBudget } from '../../functions/src/ai/budget.ts';
import {
  createBudgetedGenerator,
  createStructuredProcedureGenerator,
  runBudgetedModelTurn,
  type ReasoningConfig,
} from '../../functions/src/ai/runtime.ts';

const config: ReasoningConfig = {
  provider: 'vertex',
  projectId: 'notbad-6be95',
  location: 'eu',
  modelId: 'gemini-3.8-flash',
};

describe('budgeted model generation', () => {
  it('routes Flash-Lite through the bounded EU runtime without widening the configuration allowlist', async () => {
    const calls: unknown[] = [];
    const lite = { ...config, modelId: 'gemini-3.5-flash-lite' };
    const generate = createBudgetedGenerator(lite, async (options) => {
      calls.push(options);
      return { text: 'draft' };
    });
    const budget = createAiBudget(Date.now());
    expect(await generate(budget, '2 Matowa')).toBe('draft');
    expect(calls).toMatchObject([
      { model: 'vertexai/gemini-3.5-flash-lite', maxTurns: 1, tools: [] },
    ]);
    expect(budget.modelTurnsRemaining).toBe(4);
    for (const invalid of [
      { ...lite, location: 'global' },
      { ...lite, projectId: 'other-project' },
      { ...lite, modelId: 'arbitrary-model' },
    ]) {
      expect(() => createBudgetedGenerator(invalid)).toThrow('INVALID_CONFIG');
    }
  });

  it('counts each actual call and prevents an automatic tool loop', async () => {
    const calls: unknown[] = [];
    const generate = createBudgetedGenerator(config, async (options) => {
      calls.push(options);
      return { text: 'ok' };
    });
    const budget = createAiBudget(Date.now());
    for (let i = 0; i < 5; i++) expect(await generate(budget, 'question')).toBe('ok');
    await expect(generate(budget, 'sixth')).rejects.toMatchObject({ code: 'MODEL_LIMIT' });
    expect(calls).toHaveLength(5);
    expect(calls[0]).toMatchObject({ model: 'vertexai/gemini-3.8-flash', maxTurns: 1, tools: [] });
    expect((calls[0] as { abortSignal: AbortSignal }).abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('normalizes provider failure without refunding a turn or exposing SDK detail', async () => {
    const generate = createBudgetedGenerator(config, async () => {
      throw Error('secret SDK header token');
    });
    const budget = createAiBudget(Date.now());
    await expect(generate(budget, 'question')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'PROVIDER_UNAVAILABLE',
    });
    expect(budget.modelTurnsRemaining).toBe(4);
  });
  it('supports structured single-turn results under the same budget', async () => {
    const budget = createAiBudget(Date.now());
    const output = await runBudgetedModelTurn(budget, async (signal) => ({
      status: 'ANSWER' as const,
      aborted: signal.aborted,
    }));
    expect(output).toEqual({ status: 'ANSWER', aborted: false });
    expect(budget.modelTurnsRemaining).toBe(4);
  });
});

describe('procedure provider capacity recovery', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const output = { status: 'INSUFFICIENT_EVIDENCE', message: 'No source covers it.' };
  function capacityError(retryAfterMs?: number) {
    return new GenkitError({
      status: 'RESOURCE_EXHAUSTED',
      message: 'private provider details',
      responseMetadata: retryAfterMs === undefined ? undefined : { retryAfterMs },
    });
  }
  function clock() {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  }
  function settle<T>(work: Promise<T>) {
    return work.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
  }

  it('recovers from provider 429 after backoff under the same deadline and counts both calls', async () => {
    clock();
    const calls: unknown[] = [];
    const budget = createAiBudget(Date.now());
    const generate = createStructuredProcedureGenerator(config, async (options) => {
      calls.push(options);
      if (calls.length === 1) throw capacityError();
      return { output };
    });
    const result = settle(generate(budget, 'question'));
    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ value: output });
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(budget.modelTurnsRemaining).toBe(3);
    expect(budget.toolCallsRemaining).toBe(8);
  });

  it('honors provider Retry-After instead of sending an early retry', async () => {
    clock();
    let calls = 0;
    const generate = createStructuredProcedureGenerator(config, async () => {
      if (++calls === 1) throw capacityError(3_000);
      return { output };
    });
    const result = settle(generate(createAiBudget(Date.now()), 'question'));
    await vi.advanceTimersByTimeAsync(2_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ value: output });
    expect(calls).toBe(2);
  });

  it('stops after a second 429 and keeps SDK details out of the public error', async () => {
    clock();
    let calls = 0;
    const budget = createAiBudget(Date.now());
    const generate = createStructuredProcedureGenerator(config, async () => {
      calls++;
      throw capacityError();
    });
    const result = settle(generate(budget, 'question'));
    await vi.advanceTimersByTimeAsync(25_000);
    expect(await result).toMatchObject({
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'PROVIDER_UNAVAILABLE',
      },
    });
    expect(calls).toBe(2);
    expect(budget.modelTurnsRemaining).toBe(3);
  });

  it('cancels backoff at the existing deadline without a late provider call', async () => {
    clock();
    let calls = 0;
    const budget = createAiBudget(Date.now() - 24_500);
    const generate = createStructuredProcedureGenerator(config, async () => {
      calls++;
      throw capacityError();
    });
    const result = settle(generate(budget, 'question'));
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toMatchObject({ error: { code: 'TIMEOUT' } });
    await vi.advanceTimersByTimeAsync(25_000);
    expect(calls).toBe(1);
    expect(budget.modelTurnsRemaining).toBe(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a pending retry at the original deadline', async () => {
    clock();
    let calls = 0;
    let retrySignal: AbortSignal | undefined;
    const budget = createAiBudget(Date.now());
    const generate = createStructuredProcedureGenerator(config, async (options) => {
      if (++calls === 1) throw capacityError();
      retrySignal = options.abortSignal;
      return new Promise(() => {});
    });
    const result = settle(generate(budget, 'question'));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(2);
    expect(retrySignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(24_000);
    expect(await result).toMatchObject({ error: { code: 'TIMEOUT' } });
    expect(retrySignal?.aborted).toBe(true);
    expect(budget.modelTurnsRemaining).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    new Error('RESOURCE_EXHAUSTED private SDK text'),
    new GenkitError({ status: 'INVALID_ARGUMENT', message: 'invalid schema' }),
  ])('does not retry unclassified or invalid requests: %s', async (error) => {
    let calls = 0;
    const generate = createStructuredProcedureGenerator(config, async () => {
      calls++;
      throw error;
    });
    await expect(generate(createAiBudget(Date.now()), 'question')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(calls).toBe(1);
  });

  it('does not retry schema-invalid model output', async () => {
    let calls = 0;
    const generate = createStructuredProcedureGenerator(config, async () => {
      calls++;
      return { output: { status: 'ANSWER', steps: [] } };
    });
    await expect(generate(createAiBudget(Date.now()), 'question')).rejects.toMatchObject({
      code: 'INVALID_MODEL_OUTPUT',
    });
    expect(calls).toBe(1);
  });

  it('does not retry beyond the remaining turn allowance', async () => {
    let calls = 0;
    const budget = createAiBudget(Date.now());
    budget.modelTurnsRemaining = 1;
    const generate = createStructuredProcedureGenerator(config, async () => {
      calls++;
      throw capacityError();
    });
    await expect(generate(budget, 'question')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(calls).toBe(1);
    expect(budget.modelTurnsRemaining).toBe(0);
  });

  it('does not shorten a Retry-After longer than the entire flow budget', async () => {
    let calls = 0;
    const generate = createStructuredProcedureGenerator(config, async () => {
      calls++;
      throw capacityError(60_000);
    });
    await expect(generate(createAiBudget(Date.now()), 'question')).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(calls).toBe(1);
  });
});

describe('structured procedure generator', () => {
  it('requests schema output under one bounded no-tools model turn', async () => {
    const { createStructuredProcedureGenerator } =
      await import('../../functions/src/ai/runtime.ts');
    let options: Record<string, unknown> | undefined;
    const generate = createStructuredProcedureGenerator(config, async (value) => {
      options = value as unknown as Record<string, unknown>;
      return { output: { status: 'INSUFFICIENT_EVIDENCE', message: 'No source covers it.' } };
    });
    const budget = createAiBudget(Date.now());
    expect(await generate(budget, 'question')).toEqual({
      status: 'INSUFFICIENT_EVIDENCE',
      message: 'No source covers it.',
    });
    expect(options).toMatchObject({
      maxTurns: 1,
      tools: [],
      config: { maxOutputTokens: 1024 },
      output: { format: 'json' },
    });
    expect(options?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(budget.modelTurnsRemaining).toBe(4);
  });
});
