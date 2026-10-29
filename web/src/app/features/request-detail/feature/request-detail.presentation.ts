import type { RequestDetail, RequestState } from '../../../../../../shared/contracts/stock';

export type HistoryStep = {
  state: RequestState;
  label: string;
  kind: 'RECORDED' | 'PENDING' | 'UNAVAILABLE';
  event?: RequestDetail['timeline'][number];
};
const historyLabels: Record<RequestState, string> = {
  PENDING_APPROVAL: 'Submitted',
  RESERVED: 'Approved',
  DISPATCHED: 'Dispatched',
  RECEIVED: 'Received',
  RECEIVED_WITH_ISSUE: 'Delivery inspected · issue reported',
  REJECTED: 'Rejected',
};
export function buildRequestHistory(
  request: Pick<RequestDetail, 'state' | 'timeline' | 'items' | 'totalUnits'>,
): HistoryStep[] {
  const stages: RequestState[] =
    request.state === 'REJECTED'
      ? ['PENDING_APPROVAL', 'REJECTED']
      : [
          'PENDING_APPROVAL',
          'RESERVED',
          'DISPATCHED',
          request.state === 'RECEIVED_WITH_ISSUE' ? 'RECEIVED_WITH_ISSUE' : 'RECEIVED',
        ];
  const current = stages.indexOf(request.state);
  return stages.map((state, index) => {
    const event = request.timeline.find((entry) => entry.state === state);
    let label = historyLabels[state];
    if (event && state === 'RESERVED') label += ` · ${request.totalUnits} pcs reserved`;
    if (event && state === 'DISPATCHED')
      label += ` · ${request.items.reduce((sum, item) => sum + item.dispatchedQuantity, 0)} pcs`;
    if (event && state === 'RECEIVED')
      label += ` · ${request.items.reduce((sum, item) => sum + item.receivedQuantity, 0)} pcs received`;
    return {
      state,
      label,
      kind: event ? 'RECORDED' : index <= current ? 'UNAVAILABLE' : 'PENDING',
      ...(event ? { event } : {}),
    };
  });
}
