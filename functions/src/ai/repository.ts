import type { DataConnect } from 'firebase-admin/data-connect';
import * as sql from '@barberhq/server';
import { AiError } from './budget.js';
import type { ActorContext } from './models/actor-context.js';
import type { AiAdmissionRepository } from './models/ai-admission-repository.js';

/** Server connector only; named operations are generated from dataconnect/server/ai/admission.gql. */
type SqlOperations = Pick<typeof sql, 'readAiActor' | 'admitAiWindow'>;
export function createSqlAiRepository(
  dc: DataConnect,
  operations: SqlOperations = sql,
): AiAdmissionRepository {
  return {
    async readActor(uid: string): Promise<ActorContext | null> {
      let member: sql.ReadAiActorData['membership'];
      try {
        member = (await operations.readAiActor(dc, { uid })).data.membership;
      } catch {
        throw new AiError('SERVICE_UNAVAILABLE');
      }
      if (!member) return null;
      if (
        member.uid !== uid ||
        typeof member.businessId !== 'string' ||
        !member.businessId ||
        (member.role !== 'HQ' && member.role !== 'SALON') ||
        !Array.isArray(member.salonAccesses_on_membership)
      )
        throw new AiError('FORBIDDEN');
      const salonIds: string[] = [];
      for (const raw of member.salonAccesses_on_membership) {
        if (
          !raw ||
          typeof raw.locationId !== 'string' ||
          !raw.location ||
          typeof raw.location.businessId !== 'string' ||
          (raw.location.kind !== 'HQ' && raw.location.kind !== 'SALON')
        )
          throw new AiError('FORBIDDEN');
        if (raw.location.businessId === member.businessId && raw.location.kind === 'SALON')
          salonIds.push(raw.locationId);
      }
      if (member.role === 'SALON' && salonIds.length === 0) return null;
      return { uid, businessId: member.businessId, role: member.role, salonIds };
    },
    async increment(
      uid: string,
      businessId: string,
      role: ActorContext['role'],
    ): Promise<{ count: number } | null> {
      let raw: unknown;
      try {
        raw = (
          await operations.admitAiWindow(dc, {
            uid,
            businessId,
            role: role === 'HQ' ? sql.MemberRole.HQ : sql.MemberRole.SALON,
          })
        ).data.admitted;
      } catch (error) {
        if (error instanceof Error && error.message.includes('FORBIDDEN'))
          throw new AiError('FORBIDDEN');
        throw new AiError('SERVICE_UNAVAILABLE');
      }
      if (raw === null) return null;
      if (typeof raw !== 'object' || Array.isArray(raw)) throw new AiError('SERVICE_UNAVAILABLE');
      const count = (raw as { count?: unknown }).count;
      if (!Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > 10)
        throw new AiError('SERVICE_UNAVAILABLE');
      return { count: count as number };
    },
  };
}
