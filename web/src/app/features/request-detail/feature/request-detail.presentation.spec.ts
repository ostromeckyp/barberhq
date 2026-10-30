import { expect, it } from 'vitest';
import type { RequestDetail } from '../../../../../../shared/contracts/stock/index';
import { buildRequestHistory } from './request-detail.presentation';

const submitted = {
  state: 'PENDING_APPROVAL' as const,
  at: '2026-10-24T10:00:00Z',
  actorLabel: 'requests.actor.requester',
};
const request = {
  state: 'PENDING_APPROVAL',
  timeline: [submitted],
  items: [],
  totalUnits: 6,
} satisfies Pick<RequestDetail, 'state' | 'timeline' | 'items' | 'totalUnits'>;
it('shows actual submission and labels future stages Pending without inventing actors or times', () => {
  const steps = buildRequestHistory(request);
  expect(steps.map((s) => s.label)).toEqual([
    { key: 'requests.history.step.PENDING_APPROVAL' },
    { key: 'requests.history.step.RESERVED' },
    { key: 'requests.history.step.DISPATCHED' },
    { key: 'requests.history.step.RECEIVED' },
  ]);
  expect(steps.map((s) => s.kind)).toEqual(['RECORDED', 'PENDING', 'PENDING', 'PENDING']);
  expect(steps[0].event).toEqual(submitted);
  expect(steps.slice(1).every((s) => s.event === undefined)).toBe(true);
});
it('ends rejected history at the rejection and retains the real reason', () => {
  const event = {
    state: 'REJECTED' as const,
    at: '2026-10-24T11:00:00Z',
    actorLabel: 'HQ',
    reason: 'Verify the count.',
  };
  const steps = buildRequestHistory({
    ...request,
    state: 'REJECTED',
    timeline: [submitted, event],
  });
  expect(steps.map((s) => s.state)).toEqual(['PENDING_APPROVAL', 'REJECTED']);
  expect(steps[1].event?.reason).toBe('Verify the count.');
  expect(steps.every((s) => s.kind === 'RECORDED')).toBe(true);
});
it('does not describe a missing past record as a pending action', () => {
  const steps = buildRequestHistory({ ...request, state: 'DISPATCHED' });
  expect(steps.map((s) => s.kind)).toEqual(['RECORDED', 'UNAVAILABLE', 'UNAVAILABLE', 'PENDING']);
});
it('ends_a_problem_delivery_with_the_actual_inspection_event', () => {
  const event = {
    state: 'RECEIVED_WITH_ISSUE' as const,
    at: '2026-10-25T10:00:00Z',
    actorLabel: 'requests.actor.recipient',
  };
  const steps = buildRequestHistory({
    ...request,
    state: 'RECEIVED_WITH_ISSUE',
    timeline: [submitted, event],
  });
  expect(steps.map((step) => step.state)).toEqual([
    'PENDING_APPROVAL',
    'RESERVED',
    'DISPATCHED',
    'RECEIVED_WITH_ISSUE',
  ]);
  expect(steps.at(-1)?.kind).toBe('RECORDED');
  expect(steps.at(-1)?.event).toEqual(event);
});
it('carries the unit totals of reserved, dispatched and received steps as parameters', () => {
  const at = '2026-10-25T10:00:00Z';
  const steps = buildRequestHistory({
    state: 'RECEIVED',
    timeline: ['PENDING_APPROVAL', 'RESERVED', 'DISPATCHED', 'RECEIVED'].map((state) => ({
      state: state as RequestDetail['state'],
      at,
      actorLabel: 'requests.actor.hq',
    })),
    items: [
      { dispatchedQuantity: 3, receivedQuantity: 3 },
      { dispatchedQuantity: 4, receivedQuantity: 4 },
    ] as RequestDetail['items'],
    totalUnits: 7,
  });
  expect(steps.slice(1).map((s) => s.label)).toEqual([
    { key: 'requests.history.reserved', params: { units: 7 } },
    { key: 'requests.history.dispatched', params: { units: 7 } },
    { key: 'requests.history.received', params: { units: 7 } },
  ]);
});
