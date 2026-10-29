import {
  AiError,
  assertTimeRemaining,
  createAiBudget,
  runWithinBudget,
  type AiBudget,
} from './budget.js';
import type { ActorContext } from './context.js';

export type AiEndpoint = 'replenishment' | 'procedure' | 'product-knowledge';
export type AiAdmissionRepository = {
  readActor(uid: string): Promise<ActorContext | null>;
  /** Atomic, server-clock SQL admission. Null means the shared window is full. */
  increment(
    uid: string,
    businessId: string,
    role: ActorContext['role'],
  ): Promise<{ count: number } | null>;
};

function validActor(actor: ActorContext | null, uid: string): actor is ActorContext {
  return Boolean(
    actor &&
    actor.uid === uid &&
    actor.businessId &&
    (actor.role === 'HQ' || actor.role === 'SALON') &&
    Array.isArray(actor.salonIds) &&
    actor.salonIds.every((id) => typeof id === 'string' && id.length > 0) &&
    (actor.role === 'HQ' || actor.salonIds.length > 0),
  );
}

export function createAiAdmission(
  repository: AiAdmissionRepository,
  clock: () => number = Date.now,
) {
  const issued = new WeakSet<ActorContext>();
  const started = new WeakMap<ActorContext, number>();
  async function resolveActor(uid: string): Promise<ActorContext> {
    if (typeof uid !== 'string' || !uid.trim()) throw new AiError('UNAUTHENTICATED');
    const began = clock();
    const fresh = await runWithinBudget(createAiBudget(began, clock), () =>
      repository.readActor(uid),
    );
    if (!validActor(fresh, uid)) throw new AiError('FORBIDDEN');
    const actor = Object.freeze({ ...fresh, salonIds: Object.freeze([...fresh.salonIds]) });
    issued.add(actor);
    started.set(actor, began);
    return actor;
  }

  async function admitAiCall(
    actor: ActorContext,
    endpoint: AiEndpoint,
    input: string,
    _now: Date,
  ): Promise<AiBudget> {
    if (!issued.has(actor)) throw new AiError('FORBIDDEN');
    if (
      endpoint !== 'replenishment' &&
      endpoint !== 'procedure' &&
      endpoint !== 'product-knowledge'
    )
      throw new AiError('VALIDATION_ERROR');
    if (endpoint === 'product-knowledge' && actor.role !== 'HQ') throw new AiError('FORBIDDEN');
    if (typeof input !== 'string' || !input.trim() || [...input].length > 2000)
      throw new AiError('VALIDATION_ERROR');
    const budget = createAiBudget(started.get(actor) ?? clock(), clock);
    const result = await runWithinBudget(budget, async () => {
      const fresh = await repository.readActor(actor.uid);
      if (
        !validActor(fresh, actor.uid) ||
        fresh.businessId !== actor.businessId ||
        fresh.role !== actor.role ||
        JSON.stringify([...fresh.salonIds].sort()) !== JSON.stringify([...actor.salonIds].sort())
      )
        throw new AiError('FORBIDDEN');
      assertTimeRemaining(budget);
      return repository.increment(actor.uid, actor.businessId, actor.role);
    });
    if (result === null) throw new AiError('RATE_LIMITED');
    if (!Number.isSafeInteger(result.count) || result.count < 1 || result.count > 10)
      throw new AiError('INVALID_CONFIG');
    return budget;
  }
  return { resolveActor, admitAiCall };
}
