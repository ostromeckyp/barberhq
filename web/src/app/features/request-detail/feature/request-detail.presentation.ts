import type { TranslatedText } from '../../../core/models/translated-text';
import type { RequestDetail, RequestState } from '../../../../../../shared/contracts/stock/index';

export type HistoryStep = {
  state: RequestState;
  label: TranslatedText;
  kind: 'RECORDED' | 'PENDING' | 'UNAVAILABLE';
  event?: RequestDetail['timeline'][number];
};
const historyLabels: Record<RequestState, string> = {
  PENDING_APPROVAL: 'requests.history.step.PENDING_APPROVAL',
  RESERVED: 'requests.history.step.RESERVED',
  DISPATCHED: 'requests.history.step.DISPATCHED',
  RECEIVED: 'requests.history.step.RECEIVED',
  RECEIVED_WITH_ISSUE: 'requests.history.step.RECEIVED_WITH_ISSUE',
  REJECTED: 'requests.history.step.REJECTED',
};
type Quantities = Record<'dispatchedQuantity' | 'receivedQuantity', number>;
const sum = (items: Quantities[], field: keyof Quantities) =>
  items.reduce((total, item) => total + item[field], 0);
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
    let label: TranslatedText = { key: historyLabels[state] };
    if (event && state === 'RESERVED')
      label = { key: 'requests.history.reserved', params: { units: request.totalUnits } };
    if (event && state === 'DISPATCHED')
      label = {
        key: 'requests.history.dispatched',
        params: { units: sum(request.items, 'dispatchedQuantity') },
      };
    if (event && state === 'RECEIVED')
      label = {
        key: 'requests.history.received',
        params: { units: sum(request.items, 'receivedQuantity') },
      };
    return {
      state,
      label,
      kind: event ? 'RECORDED' : index <= current ? 'UNAVAILABLE' : 'PENDING',
      ...(event ? { event } : {}),
    };
  });
}
