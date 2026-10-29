import type { SessionState } from '../../../../../../shared/contracts/business/index';
import type { Workspace } from '../../../core/salon-context';
import type { DeliveryScope } from '../models/delivery-scope';

type Param = string | null | undefined;

/** Receipt scope for a member working in the salon that owns the request. */
export function deliveryReceiptScope(
  s: SessionState,
  workspace: Workspace | null | undefined,
  salonId: Param,
  targetId: Param,
): DeliveryScope | undefined {
  return s.status === 'READY' &&
    salonId &&
    targetId &&
    s.membership.salonIds.includes(salonId) &&
    workspace?.kind === 'SALON' &&
    workspace.salonId === salonId
    ? { userId: s.membership.userId, businessId: s.membership.businessId, salonId, targetId }
    : undefined;
}

/** Issue identity for the HQ or salon view, or undefined when this member may not open it. */
export function deliveryIssueIdentity(
  s: SessionState,
  w: Workspace | null | undefined,
  view: 'HQ' | 'SALON',
  id: Param,
  salonId: Param,
) {
  if (s.status !== 'READY' || !id) return undefined;
  if (view === 'HQ' && (s.membership.role !== 'HQ' || w?.kind !== 'HQ')) return undefined;
  if (
    view === 'SALON' &&
    (!salonId ||
      !s.membership.salonIds.includes(salonId) ||
      w?.kind !== 'SALON' ||
      w.salonId !== salonId)
  )
    return undefined;
  return {
    id,
    userId: s.membership.userId,
    businessId: s.membership.businessId,
    salonId,
    key: JSON.stringify([s.membership.userId, s.membership.businessId, view, id, salonId]),
  };
}
