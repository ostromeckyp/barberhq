import type { ActorContext } from './actor-context.js';

export type AiAdmissionRepository = {
  readActor(uid: string): Promise<ActorContext | null>;
  /** Atomic, server-clock SQL admission. Null means the shared window is full. */
  increment(
    uid: string,
    businessId: string,
    role: ActorContext['role'],
  ): Promise<{ count: number } | null>;
};
