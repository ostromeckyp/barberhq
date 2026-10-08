import type { Membership } from '../../../../shared/contracts/business';
import type { RequestFilter, RequestSummary } from '../../../../shared/contracts/stock';
export type RequestListContext =
  | { kind: 'SALON'; salonId: string; filter: RequestFilter; offset: number }
  | { kind: 'HQ'; offset: number };
export const requestFilter = (value: unknown): RequestFilter =>
  ['ALL', 'ACTIVE', 'RECEIVED', 'REJECTED'].includes(String(value))
    ? (value as RequestFilter)
    : 'ALL';
export const pageOffset = (value: unknown): number => {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 2147483647 ? n : 0;
};
export function parseListContext(input: unknown): RequestListContext | undefined {
  if (!input || typeof input !== 'object') return;
  const v = input as Record<string, unknown>;
  if (v['kind'] === 'HQ') return { kind: 'HQ', offset: pageOffset(v['offset']) };
  if (
    v['kind'] === 'SALON' &&
    typeof v['salonId'] === 'string' &&
    v['salonId'].length > 0 &&
    v['salonId'].length <= 256
  )
    return {
      kind: 'SALON',
      salonId: v['salonId'],
      filter: requestFilter(v['filter']),
      offset: pageOffset(v['offset']),
    };
  return;
}
export function requestReturnContext(
  request: RequestSummary,
  membership: Membership,
  candidate?: RequestListContext,
  workspace: 'HQ' | 'SALON' = membership.role,
): RequestListContext {
  if (!membership.salonIds.includes(request.salonId)) throw Error('Unauthorized request salon');
  const safe = parseListContext(candidate);
  if (safe?.kind === 'HQ' && membership.role === 'HQ' && workspace === 'HQ') return safe;
  if (safe?.kind === 'SALON' && safe.salonId === request.salonId && workspace === 'SALON')
    return safe;
  return membership.role === 'HQ' && workspace === 'HQ'
    ? { kind: 'HQ', offset: 0 }
    : { kind: 'SALON', salonId: request.salonId, filter: 'ALL', offset: 0 };
}
