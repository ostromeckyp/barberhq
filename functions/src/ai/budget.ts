import type { AiBudget } from './models/ai-budget.js';
import type { AiErrorCode } from './models/ai-error-code.js';

export class AiError extends Error {
  constructor(public readonly code: AiErrorCode) {
    super(code);
    this.name = 'AiError';
  }
}

const clocks = new WeakMap<AiBudget, () => number>();

/** Start before admission so SQL, retrieval, tools, and provider share one deadline. */
export function createAiBudget(startedMs: number, clock: () => number = Date.now): AiBudget {
  if (!Number.isFinite(startedMs)) throw new AiError('INVALID_CONFIG');
  const budget = { deadlineMs: startedMs + 25_000, modelTurnsRemaining: 5, toolCallsRemaining: 8 };
  clocks.set(budget, clock);
  return budget;
}

function remainingMs(budget: AiBudget): number {
  const clock = clocks.get(budget);
  if (!clock) throw new AiError('INVALID_CONFIG');
  return budget.deadlineMs - clock();
}

export function assertTimeRemaining(budget: AiBudget): void {
  if (remainingMs(budget) <= 0) throw new AiError('TIMEOUT');
}

export function consumeModelTurn(budget: AiBudget): void {
  assertTimeRemaining(budget);
  if (budget.modelTurnsRemaining <= 0) throw new AiError('MODEL_LIMIT');
  budget.modelTurnsRemaining--;
}

export function consumeToolCall(budget: AiBudget): void {
  assertTimeRemaining(budget);
  if (budget.toolCallsRemaining <= 0) throw new AiError('TOOL_LIMIT');
  budget.toolCallsRemaining--;
}

/** Abort cooperative work, reject promptly, and observe late settlement without returning it. */
export async function runWithinBudget<T>(
  budget: AiBudget,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  assertTimeRemaining(budget);
  const controller = new AbortController();
  const timeoutMs = remainingMs(budget);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AiError('TIMEOUT'));
    }, timeoutMs);
  });
  try {
    const result = await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      deadline,
    ]);
    assertTimeRemaining(budget);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Run optional work against a child budget that ends `reserveMs` before the parent, so later
 * steps keep their time. Model-turn and tool-call counters stay shared with the parent.
 */
export async function runWithReservedTime<T>(
  budget: AiBudget,
  reserveMs: number,
  work: (child: AiBudget) => Promise<T>,
): Promise<T> {
  const clock = clocks.get(budget);
  if (!clock) throw new AiError('INVALID_CONFIG');
  const child = { ...budget, deadlineMs: budget.deadlineMs - reserveMs };
  clocks.set(child, clock);
  try {
    return await runWithinBudget(child, () => work(child));
  } finally {
    budget.modelTurnsRemaining = Math.min(budget.modelTurnsRemaining, child.modelTurnsRemaining);
    budget.toolCallsRemaining = Math.min(budget.toolCallsRemaining, child.toolCallsRemaining);
  }
}
