import type { RequestDetail, StockAction } from '../../../../../../shared/contracts/stock';
export type TransitionType = Exclude<StockAction['type'], 'SUBMIT'>;
export type Confirmation = { reason: string; receivedQuantity: number; allIntact: boolean };
export const ACTION_LABELS: Record<TransitionType, string> = {
  APPROVE: 'Approve request',
  REJECT: 'Reject request',
  DISPATCH: 'Confirm dispatch',
  RECEIVE: 'Confirm receipt',
};
export function canConfirm(
  type: TransitionType,
  request: RequestDetail,
  value: Confirmation,
): boolean {
  switch (type) {
    case 'APPROVE':
      return request.state === 'PENDING_APPROVAL' && request.stock.hqAvailable >= request.quantity;
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
        value.receivedQuantity === request.quantity
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
      return { type, input: { ...common, expectedHqInventoryVersion: request.hqInventoryVersion } };
    case 'REJECT':
      return { type, input: { ...common, reason: value.reason.trim() } };
    case 'DISPATCH':
      return { type, input: common };
    case 'RECEIVE':
      return {
        type,
        input: { ...common, receivedQuantity: value.receivedQuantity, allIntact: true },
      };
  }
}
