import type { RequestDetail, StockAction } from '../../../../../../shared/contracts/stock/index';
import type { Membership } from '../../../../../../shared/contracts/business/index';
import type { Confirmation } from '../models/confirmation';
import type { TransitionType } from '../models/transition-type';
export const ACTION_LABELS: Record<TransitionType, string> = {
  APPROVE: 'Approve request',
  REJECT: 'Reject request',
  DISPATCH: 'Confirm dispatch',
  RECEIVE: 'Check delivery',
};
export function availableRequestActions(
  membership: Membership,
  request: Pick<RequestDetail, 'salonId' | 'state'>,
  workspace: 'HQ' | 'SALON',
): TransitionType[] {
  if (!membership.salonIds.includes(request.salonId)) return [];
  if (workspace === 'HQ') {
    if (membership.role !== 'HQ') return [];
    return request.state === 'PENDING_APPROVAL'
      ? ['APPROVE', 'REJECT']
      : request.state === 'RESERVED'
        ? ['DISPATCH']
        : [];
  }
  return request.state === 'DISPATCHED' ? ['RECEIVE'] : [];
}
export function canConfirm(
  type: TransitionType,
  request: RequestDetail,
  value: Confirmation,
): boolean {
  switch (type) {
    case 'APPROVE':
      return (
        request.state === 'PENDING_APPROVAL' &&
        request.items.every((item) => item.stock.hqAvailable >= item.quantity)
      );
    case 'REJECT':
      return (
        request.state === 'PENDING_APPROVAL' &&
        value.reason.trim().length > 0 &&
        value.reason.trim().length <= 500
      );
    case 'DISPATCH':
      return request.state === 'RESERVED';
    case 'RECEIVE':
      return (
        request.state === 'DISPATCHED' &&
        value.allIntact &&
        value.items.length === request.items.length &&
        new Set(value.items.map((i) => i.productId)).size === value.items.length &&
        request.items.every((item) =>
          value.items.some(
            (i) => i.productId === item.productId && i.receivedQuantity === item.quantity,
          ),
        )
      );
  }
}
export function buildAction(
  type: TransitionType,
  request: RequestDetail,
  value: Confirmation,
  key: string,
): StockAction {
  const common = { requestId: request.id, expectedRevision: request.revision, idempotencyKey: key };
  switch (type) {
    case 'APPROVE':
      return {
        type,
        input: {
          ...common,
          inventoryVersions: request.items.map((i) => ({
            productId: i.productId,
            expectedHqInventoryVersion: i.stock.hqInventoryVersion,
          })),
        },
      };
    case 'REJECT':
      return { type, input: { ...common, reason: value.reason.trim() } };
    case 'DISPATCH':
      return { type, input: common };
    case 'RECEIVE':
      return {
        type,
        input: { ...common, items: value.items.map((i) => ({ ...i })), allIntact: true },
      };
  }
}
