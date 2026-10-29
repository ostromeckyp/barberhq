import { it, expect } from 'vitest';
import { deliveryReturn } from './delivery-return';
const member = {
  userId: 'user',
  businessId: 'business',
  role: 'SALON' as const,
  salonIds: ['salon'],
};
const query = new URLSearchParams({
  returnTo: 'delivery-receipt',
  salonId: 'salon',
  requestId: 'request',
});
it('returns to an authorized receipt only in its current salon workspace', () => {
  expect(deliveryReturn(query, member, { kind: 'SALON', salonId: 'salon' })).toEqual({
    commands: ['/salons', 'salon', 'requests', 'request', 'receipt'],
    label: 'Check delivery',
  });
  expect(deliveryReturn(query, member, { kind: 'HQ' })).toBeNull();
  expect(
    deliveryReturn(query, { ...member, salonIds: [] }, { kind: 'SALON', salonId: 'salon' }),
  ).toBeNull();
});
it('does not accept a URL or unsafe identifier as a return destination', () => {
  query.set('requestId', 'https://outside.test/path');
  expect(deliveryReturn(query, member, { kind: 'SALON', salonId: 'salon' })).toBeNull();
  query.set('requestId', '../request');
  expect(deliveryReturn(query, member, { kind: 'SALON', salonId: 'salon' })).toBeNull();
});

it('returns an HQ issue PDF to the verified HQ workspace only', () => {
  const q = new URLSearchParams({
    returnTo: 'delivery-issue',
    issueId: 'issue',
    salonId: 'salon',
    workspace: 'HQ',
  });
  const hq = { ...member, role: 'HQ' as const };
  expect(deliveryReturn(q, hq, { kind: 'HQ' })).toEqual({
    commands: ['/hq', 'delivery-issues', 'issue'],
    label: 'Delivery issue',
  });
  expect(deliveryReturn(q, hq, { kind: 'SALON', salonId: 'salon' })).toBeNull();
  expect(deliveryReturn(q, member, { kind: 'HQ' })).toBeNull();
  q.set('workspace', 'SALON');
  expect(deliveryReturn(q, member, { kind: 'SALON', salonId: 'salon' })).toEqual({
    commands: ['/salons', 'salon', 'delivery-issues', 'issue'],
    label: 'Delivery issue',
  });
});

it('preserves only normalized receipt list context through a PDF return', () => {
  const q = new URLSearchParams({
    returnTo: 'delivery-receipt',
    salonId: 'salon',
    requestId: 'request',
    filter: 'ACTIVE',
    offset: '20',
    redirect: 'https://outside.test',
  });
  expect(deliveryReturn(q, member, { kind: 'SALON', salonId: 'salon' })).toEqual({
    commands: ['/salons', 'salon', 'requests', 'request', 'receipt'],
    label: 'Check delivery',
    queryParams: { filter: 'ACTIVE', offset: 20 },
  });
  q.set('filter', 'invented');
  q.set('offset', '-20');
  expect(deliveryReturn(q, member, { kind: 'SALON', salonId: 'salon' })).toEqual(
    expect.objectContaining({ queryParams: { filter: 'ALL', offset: 0 } }),
  );
});
it('retains the validated HQ issue list page across PDF navigation', () => {
  const q = new URLSearchParams({
    returnTo: 'delivery-issue',
    issueId: 'issue',
    salonId: 'salon',
    workspace: 'HQ',
    issueStatus: 'ALL',
    issueOffset: '20',
  });
  expect(deliveryReturn(q, { ...member, role: 'HQ' }, { kind: 'HQ' })).toEqual(
    expect.objectContaining({ queryParams: { issueStatus: 'ALL', issueOffset: 20 } }),
  );
  q.set('issueStatus', 'https://outside.test');
  q.set('issueOffset', '2147483648');
  expect(deliveryReturn(q, { ...member, role: 'HQ' }, { kind: 'HQ' })).toEqual(
    expect.objectContaining({ queryParams: { issueStatus: 'OPEN', issueOffset: 0 } }),
  );
});
