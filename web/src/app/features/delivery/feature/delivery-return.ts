import type { Membership } from '../../../../../../shared/contracts/business/index';
import type { Workspace } from '../../../core/salon-context';
import { pageOffset, requestFilter } from '../../../core/request-navigation';
type Query = { get(name: string): string | null };
export function deliveryReceiptQuery(query: Query | undefined) {
  return query && (query.get('filter') !== null || query.get('offset') !== null)
    ? { filter: requestFilter(query.get('filter')), offset: pageOffset(query.get('offset')) }
    : undefined;
}
export function deliveryIssueQuery(query: Query | undefined) {
  return query && (query.get('issueStatus') !== null || query.get('issueOffset') !== null)
    ? {
        issueStatus: query.get('issueStatus') === 'ALL' ? 'ALL' : 'OPEN',
        issueOffset: pageOffset(query.get('issueOffset')),
      }
    : undefined;
}
const safeId = (value: string | null): value is string =>
  !!value &&
  value.length <= 300 &&
  !/[\s/\\?#\u0000-\u001f]/.test(value) &&
  value !== '.' &&
  value !== '..';
export function deliveryReturn(
  query: { get(name: string): string | null },
  member: Membership,
  workspace: Workspace | undefined,
): { commands: string[]; label: string; queryParams?: Record<string, string | number> } | null {
  const issueId = query.get('issueId'),
    salon = query.get('salonId');
  if (
    query.get('returnTo') === 'delivery-issue' &&
    safeId(issueId) &&
    safeId(salon) &&
    member.salonIds.includes(salon)
  ) {
    if (query.get('workspace') === 'HQ' && member.role === 'HQ' && workspace?.kind === 'HQ')
      return {
        commands: ['/hq', 'delivery-issues', issueId],
        label: 'Delivery issue',
        ...(deliveryIssueQuery(query) ? { queryParams: deliveryIssueQuery(query) } : {}),
      };
    if (
      query.get('workspace') === 'SALON' &&
      workspace?.kind === 'SALON' &&
      workspace.salonId === salon
    )
      return { commands: ['/salons', salon, 'delivery-issues', issueId], label: 'Delivery issue' };
    return null;
  }
  const salonId = query.get('salonId'),
    requestId = query.get('requestId');
  if (
    query.get('returnTo') !== 'delivery-receipt' ||
    !safeId(salonId) ||
    !safeId(requestId) ||
    !member.salonIds.includes(salonId) ||
    workspace?.kind !== 'SALON' ||
    workspace.salonId !== salonId
  )
    return null;
  return {
    commands: ['/salons', salonId, 'requests', requestId, 'receipt'],
    label: 'Check delivery',
    ...(deliveryReceiptQuery(query) ? { queryParams: deliveryReceiptQuery(query) } : {}),
  };
}
