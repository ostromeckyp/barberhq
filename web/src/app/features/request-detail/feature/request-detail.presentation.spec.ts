import { expect, it } from 'vitest';
import type { RequestDetail } from '../../../../../../shared/contracts/stock';
import { buildRequestHistory } from './request-detail.presentation';

const submitted = {
  state: 'PENDING_APPROVAL' as const,
  at: '2026-10-24T10:00:00Z',
  actorLabel: 'Requester',
};
const request = {
  state: 'PENDING_APPROVAL',
  timeline: [submitted],
  items: [],
  totalUnits: 6,
} satisfies Pick<RequestDetail, 'state' | 'timeline' | 'items' | 'totalUnits'>;
it('shows actual submission and labels future stages Pending without inventing actors or times', () => {
  const steps = buildRequestHistory(request);
  expect(steps.map((s) => s.label)).toEqual(['Submitted', 'Approved', 'Dispatched', 'Received']);
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
    actorLabel: 'Recipient',
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
